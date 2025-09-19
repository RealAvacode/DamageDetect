import OpenAI from 'openai';
import { InsertAssessment } from '@shared/schema';
import { extractVideoFrames, checkFFmpegAvailability, VideoFrameExtractionResult } from './video-utils';
import { z } from 'zod';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Verify API key is available
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

export interface DetailedFinding {
  category: string;
  severity: 'Low' | 'Medium' | 'High';
  description: string;
}

// Validation schema for AI assessment responses
const detailedFindingSchema = z.object({
  category: z.string(),
  severity: z.enum(['Low', 'Medium', 'High']),
  description: z.string()
});

const aiAssessmentResponseSchema = z.object({
  grade: z.enum(['A', 'B', 'C', 'D']),
  confidence: z.number().min(0).max(1),
  overallCondition: z.string(),
  damageTypes: z.array(z.string()),
  detailedFindings: z.array(detailedFindingSchema)
});

/**
 * Validate AI assessment response against expected schema
 */
function validateAIResponse(response: any): z.infer<typeof aiAssessmentResponseSchema> {
  try {
    return aiAssessmentResponseSchema.parse(response);
  } catch (error) {
    console.error('AI response validation failed:', error);
    throw new Error(`Invalid AI response structure: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
  }
}

export interface AIAssessmentResult {
  grade: 'A' | 'B' | 'C' | 'D';
  confidence: number;
  overallCondition: string;
  damageTypes: string[];
  detailedFindings: DetailedFinding[];
  processingTime: number;
  videoMetadata?: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    framesAnalyzed: number;
  };
}

export async function assessLaptopDamage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<AIAssessmentResult> {
  const startTime = Date.now();

  // Debug logging to understand what's being sent to OpenAI
  console.log('Assessment request details:');
  console.log('- MIME type:', mimeType);
  console.log('- Base64 length:', imageBase64.length);
  console.log('- Base64 sample (first 32 chars):', imageBase64.substring(0, 32));
  console.log('- Data URL header:', `data:${mimeType};base64,`);

  // Validate image format and size
  if (!imageBase64 || imageBase64.length < 100) {
    throw new Error('Image data is too small or corrupted. Please upload a clear, high-resolution image of the laptop.');
  }

  // Convert HEIC files to JPEG for OpenAI compatibility
  let processedImageBase64 = imageBase64;
  let processedMimeType = mimeType;
  
  if (mimeType.toLowerCase() === 'image/heic' || mimeType.toLowerCase() === 'image/heif') {
    try {
      console.log('Converting HEIC/HEIF to JPEG for OpenAI compatibility...');
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const jpegBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 90 }) // High quality JPEG conversion
        .toBuffer();
      
      processedImageBase64 = jpegBuffer.toString('base64');
      processedMimeType = 'image/jpeg';
      console.log('HEIC conversion successful. New JPEG size:', processedImageBase64.length);
    } catch (conversionError) {
      console.error('HEIC conversion failed:', conversionError);
      throw new Error('HEIC image conversion failed. Please try converting your HEIC file to JPEG manually, or use a different image format.');
    }
  }

  // Ensure MIME type is supported by OpenAI Vision API (after potential conversion)
  const openAISupportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!openAISupportedTypes.includes(processedMimeType.toLowerCase())) {
    throw new Error(`Image format '${processedMimeType}' is not supported by the AI vision system. Please upload a JPEG, PNG, GIF, or WebP image.`);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o which supports vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a professional laptop condition assessor. Analyze this laptop image and provide a detailed damage assessment.

Return your assessment as a JSON object with this exact structure:
{
  "grade": "A" | "B" | "C" | "D",
  "confidence": 0.0 to 1.0,
  "overallCondition": "Brief overall condition summary",
  "damageTypes": ["array", "of", "damage", "types"],
  "detailedFindings": [
    {
      "category": "Display Lid" | "Base/Keyboard Area" | "Screen" | "Ports/Connectors" | "Hinges" | "Overall Structure",
      "severity": "Low" | "Medium" | "High",
      "description": "Detailed description of findings"
    }
  ]
}

Grading Scale:
- Grade A (90-100%): Excellent condition, minimal wear, no functional damage
- Grade B (75-89%): Good condition, minor cosmetic wear, fully functional
- Grade C (60-74%): Fair condition, moderate wear/damage, may have minor functional issues
- Grade D (Below 60%): Poor condition, significant damage, major functional concerns

Focus on:
- Screen condition (cracks, dead pixels, backlight issues)
- Keyboard and trackpad wear
- Case/lid scratches, dents, cracks
- Hinge condition and alignment
- Port condition
- Overall structural integrity

Be thorough but concise. Provide realistic confidence scores based on image quality and visibility of potential issues.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${processedMimeType};base64,${processedImageBase64}`
              }
            }
          ]
        }
      ],
      max_completion_tokens: 1000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const processingTime = (Date.now() - startTime) / 1000;
    
    // Enhanced logging to debug OpenAI response issues
    console.log('OpenAI response details:', {
      choices: response.choices?.length || 0,
      firstChoice: response.choices?.[0],
      message: response.choices?.[0]?.message,
      content: response.choices?.[0]?.message?.content,
      finishReason: response.choices?.[0]?.finish_reason,
      usage: response.usage
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`No response content from OpenAI. Response had ${response.choices?.length || 0} choices. First choice finish reason: ${response.choices?.[0]?.finish_reason || 'unknown'}`);
    }

    try {
      // Parse JSON response (should be clean JSON due to response_format)
      const rawResult = JSON.parse(content);
      
      // Validate the response structure
      const validatedResult = validateAIResponse(rawResult);

      return {
        ...validatedResult,
        processingTime
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from AI assessment');
    }

  } catch (error: any) {
    console.error('OpenAI API error:', error);
    
    // Provide more specific error messages for common OpenAI errors
    if (error?.code === 'image_parse_error') {
      throw new Error('Image could not be processed by AI. Please upload a clear, well-lit photo of the laptop taken from a normal distance (not too close). Ensure the image is in JPEG or PNG format and shows the laptop clearly against a plain background.');
    }
    
    if (error?.message?.includes('unsupported image') || error?.message?.includes('invalid image')) {
      throw new Error('Image format issue. Please upload a standard JPEG or PNG photo of the laptop. Avoid screenshots, very small images, or corrupted files. Take a clear photo with good lighting.');
    }
    
    if (error?.status === 400 && error?.message?.includes('image')) {
      throw new Error('Image quality issue. Please take a new photo of the laptop with: 1) Good lighting, 2) Clear focus, 3) Normal distance (not too close), 4) Plain background. Save as JPEG or PNG format.');
    }
    
    throw new Error(`AI assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Assess laptop damage from video file by extracting frames and analyzing them
 */
export async function assessLaptopDamageFromVideo(videoBuffer: Buffer): Promise<AIAssessmentResult> {
  const startTime = Date.now();

  // Check if ffmpeg is available
  const isFFmpegAvailable = await checkFFmpegAvailability();
  if (!isFFmpegAvailable) {
    throw new Error('FFmpeg is not available for video processing');
  }

  try {
    // Extract frames from video
    const frameResult: VideoFrameExtractionResult = await extractVideoFrames(videoBuffer, 3);
    
    if (!frameResult.success || frameResult.frames.length === 0) {
      throw new Error(frameResult.error || 'Failed to extract frames from video');
    }

    // Analyze the best quality frame (typically the middle one)
    const bestFrameIndex = Math.floor(frameResult.frames.length / 2);
    const bestFrame = frameResult.frames[bestFrameIndex];
    const frameBase64 = fileToBase64(bestFrame);

    // Use the existing image assessment function with enhanced prompt for video context
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a professional laptop condition assessor analyzing a frame extracted from a video assessment. This frame represents one view of the laptop during video recording.

Return your assessment as a JSON object with this exact structure:
{
  "grade": "A" | "B" | "C" | "D",
  "confidence": 0.0 to 1.0,
  "overallCondition": "Brief overall condition summary",
  "damageTypes": ["array", "of", "damage", "types"],
  "detailedFindings": [
    {
      "category": "Display Lid" | "Base/Keyboard Area" | "Screen" | "Ports/Connectors" | "Hinges" | "Overall Structure",
      "severity": "Low" | "Medium" | "High",
      "description": "Detailed description of findings"
    }
  ]
}

Grading Scale:
- Grade A (90-100%): Excellent condition, minimal wear, no functional damage
- Grade B (75-89%): Good condition, minor cosmetic wear, fully functional
- Grade C (60-74%): Fair condition, moderate wear/damage, may have minor functional issues
- Grade D (Below 60%): Poor condition, significant damage, major functional concerns

Since this is from a video, consider:
- This frame may show the laptop from a specific angle - adjust confidence accordingly
- Video quality may affect detail visibility
- Multiple angles in video provide comprehensive view
- Focus on clearly visible damage indicators

Note: Confidence should reflect both the assessment certainty and the limitations of single-frame analysis from video.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${frameBase64}`
              }
            }
          ]
        }
      ],
      max_completion_tokens: 1000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const processingTime = (Date.now() - startTime) / 1000;
    
    // Enhanced logging to debug OpenAI response issues
    console.log('OpenAI response details:', {
      choices: response.choices?.length || 0,
      firstChoice: response.choices?.[0],
      message: response.choices?.[0]?.message,
      content: response.choices?.[0]?.message?.content,
      finishReason: response.choices?.[0]?.finish_reason,
      usage: response.usage
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(`No response content from OpenAI. Response had ${response.choices?.length || 0} choices. First choice finish reason: ${response.choices?.[0]?.finish_reason || 'unknown'}`);
    }

    try {
      const rawResult = JSON.parse(content);
      
      // Validate the response structure
      const validatedResult = validateAIResponse(rawResult);

      return {
        ...validatedResult,
        processingTime,
        videoMetadata: {
          duration: frameResult.metadata?.duration || 0,
          width: frameResult.metadata?.width || 0,
          height: frameResult.metadata?.height || 0,
          fps: frameResult.metadata?.fps || 0,
          framesAnalyzed: frameResult.frames.length
        }
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from AI assessment');
    }

  } catch (error) {
    console.error('Video assessment error:', error);
    throw new Error(`Video assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to convert file to base64
export function fileToBase64(file: Buffer): string {
  return file.toString('base64');
}