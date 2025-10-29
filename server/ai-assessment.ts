import OpenAI from 'openai';
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

export interface ImageAnalysisDetail {
  imageIndex: number;
  summary: string;
  damageTypes: string[];
  detailedFindings: DetailedFinding[];
  originalFileName?: string;
}

export interface MultiImageAssessmentResult {
  grade: 'A' | 'B' | 'C' | 'D';
  confidence: number;
  overallCondition: string;
  damageTypes: string[];
  detailedFindings: DetailedFinding[];
  imageAnalyses: ImageAnalysisDetail[];
  processingTime: number;
}

interface PreparedImage {
  processedBase64: string;
  processedMimeType: string;
}

const multiImageAnalysisSchema = z.object({
  grade: z.enum(['A', 'B', 'C', 'D']),
  confidence: z.number().min(0).max(1),
  overallCondition: z.string(),
  damageTypes: z.array(z.string()),
  detailedFindings: z.array(detailedFindingSchema),
  imageAnalyses: z.array(z.object({
    imageIndex: z.number().int().min(1),
    summary: z.string(),
    damageTypes: z.array(z.string()),
    detailedFindings: z.array(detailedFindingSchema),
    originalFileName: z.string().optional()
  }))
});

async function prepareImageForVision(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<PreparedImage> {
  // Validate image format and size
  if (!imageBase64 || imageBase64.length < 50) {
    throw new Error('Image data is too small or corrupted. Please upload a clear, high-resolution image of the laptop.');
  }

  const cleanBase64 = imageBase64.replace(/[^A-Za-z0-9+/=]/g, '');

  if (cleanBase64.length % 4 !== 0) {
    throw new Error('Invalid image data format. Please try uploading a different image.');
  }

  const originalSupportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
  if (!originalSupportedTypes.includes(mimeType.toLowerCase())) {
    throw new Error(`Image format '${mimeType}' is not supported by the AI vision system. Please upload a JPEG, PNG, GIF, WebP, or HEIC image.`);
  }

  try {
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    await sharp(imageBuffer).metadata();
    const reprocessedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 95, mozjpeg: true })
      .toBuffer();

    return {
      processedBase64: reprocessedBuffer.toString('base64'),
      processedMimeType: 'image/jpeg'
    };
  } catch (sharpError) {
    console.error('Image validation failed:', sharpError);
    throw new Error('Invalid or corrupted image file. Please upload a different image.');
  }
}

export async function assessLaptopDamage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<AIAssessmentResult> {
  const startTime = Date.now();

  const { processedBase64, processedMimeType } = await prepareImageForVision(imageBase64, mimeType);

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
                url: `data:${processedMimeType};base64,${processedBase64}`
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

export async function assessLaptopDamageBatch(images: { base64: string; mimeType: string; originalFileName?: string }[]): Promise<MultiImageAssessmentResult> {
  if (!images || images.length === 0) {
    throw new Error('No images provided for assessment');
  }

  const startTime = Date.now();

  const processedImages: { processedBase64: string; processedMimeType: string; originalFileName?: string }[] = [];

  for (const image of images) {
    const prepared = await prepareImageForVision(image.base64, image.mimeType);
    processedImages.push({
      processedBase64: prepared.processedBase64,
      processedMimeType: prepared.processedMimeType,
      originalFileName: image.originalFileName
    });
  }

  const analysisInstruction = `You are a professional laptop condition assessor. You will receive ${processedImages.length} laptop photo${processedImages.length > 1 ? 's' : ''}.

For each photo, provide a thorough analysis BEFORE giving the overall grade. Return a JSON object with this exact structure:
{
  "grade": "A" | "B" | "C" | "D",
  "confidence": 0.0 to 1.0,
  "overallCondition": "Overall summary after reviewing every image",
  "damageTypes": ["array", "of", "damage", "types"],
  "detailedFindings": [
    {
      "category": "Display Lid" | "Base/Keyboard Area" | "Screen" | "Ports/Connectors" | "Hinges" | "Overall Structure",
      "severity": "Low" | "Medium" | "High",
      "description": "Combined description across all images"
    }
  ],
  "imageAnalyses": [
    {
      "imageIndex": 1,
      "summary": "Summary for the specific photo",
      "damageTypes": ["damage", "types", "seen", "in", "this", "image"],
      "detailedFindings": [
        {
          "category": "Display Lid" | "Base/Keyboard Area" | "Screen" | "Ports/Connectors" | "Hinges" | "Overall Structure",
          "severity": "Low" | "Medium" | "High",
          "description": "Observation specific to this image"
        }
      ]
    }
  ]
}

Discuss every photo individually within imageAnalyses before summarizing and grading the overall condition.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: analysisInstruction },
            ...processedImages.flatMap((image, index) => [
              {
                type: 'text' as const,
                text: `Image ${index + 1}${image.originalFileName ? ` (${image.originalFileName})` : ''}`
              },
              {
                type: 'image_url' as const,
                image_url: {
                  url: `data:${image.processedMimeType};base64,${image.processedBase64}`,
                  detail: 'auto'
                }
              }
            ])
          ]
        }
      ],
      max_completion_tokens: 1200,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const processingTime = (Date.now() - startTime) / 1000;

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI when processing multiple images');
    }

    const parsed = JSON.parse(content);
    const validated = multiImageAnalysisSchema.parse(parsed);

    const normalizedImageAnalyses: ImageAnalysisDetail[] = validated.imageAnalyses.map((analysis) => ({
      ...analysis,
      originalFileName:
        analysis.originalFileName ||
        processedImages[analysis.imageIndex - 1]?.originalFileName ||
        undefined,
    }));

    return {
      ...validated,
      imageAnalyses: normalizedImageAnalyses,
      processingTime
    };
  } catch (error: any) {
    console.error('Multi-image assessment error:', error);

    if (error?.code === 'image_parse_error') {
      throw new Error('One or more images could not be processed by AI. Please ensure each photo is clear, in focus, and saved in JPEG or PNG format.');
    }

    if (error?.message?.includes('unsupported image') || error?.message?.includes('invalid image')) {
      throw new Error('One or more images are using an unsupported format. Please upload JPEG, PNG, GIF, WebP, or HEIC photos.');
    }

    throw new Error(`AI assessment failed for multiple images: ${error instanceof Error ? error.message : 'Unknown error'}`);
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