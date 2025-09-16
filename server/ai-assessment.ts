import OpenAI from 'openai';
import { InsertAssessment } from '@shared/schema';

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

export interface AIAssessmentResult {
  grade: 'A' | 'B' | 'C' | 'D';
  confidence: number;
  overallCondition: string;
  damageTypes: string[];
  detailedFindings: DetailedFinding[];
  processingTime: number;
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
      const result = JSON.parse(content);

      return {
        ...result,
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

// Helper function to convert file to base64
export function fileToBase64(file: Buffer): string {
  return file.toString('base64');
}