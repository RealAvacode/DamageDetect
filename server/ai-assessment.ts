import OpenAI from 'openai';
import { InsertAssessment } from '@shared/schema';
import { extractVideoFrames, checkFFmpegAvailability, VideoFrameExtractionResult } from './video-utils';
import { z } from 'zod';

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

export async function assessLaptopDamage(imageBase64: string): Promise<AIAssessmentResult> {
  const startTime = Date.now();

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
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const processingTime = (Date.now() - startTime) / 1000;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from OpenAI');
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

  } catch (error) {
    console.error('OpenAI API error:', error);
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
      max_tokens: 1000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const processingTime = (Date.now() - startTime) / 1000;
    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from OpenAI');
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