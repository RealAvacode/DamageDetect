import OpenAI from "openai";
import type { AssessmentData, ChatMessage } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface SimpleChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export async function handleChatMessage(
  message: string,
  conversationHistory: SimpleChatMessage[]
): Promise<string> {
  try {
    const systemPrompt = `You are a helpful laptop diagnostic assistant. You help users assess laptop condition, interpret damage assessments, and answer questions about laptop hardware issues.

Key capabilities:
- Guide users through diagnostic processes
- Explain assessment results in simple terms
- Provide recommendations based on laptop condition
- Answer questions about laptop hardware, damage types, and repair costs
- Help users understand grading (A=Excellent, B=Good, C=Fair, D=Poor)

Be conversational, friendly, and helpful. Keep responses concise but informative.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: messages,
      max_tokens: 500
    });

    return response.choices[0].message.content || "I apologize, but I couldn't process your request. Please try again.";
  } catch (error) {
    console.error('Chat handler error:', error);
    throw new Error('Failed to process chat message');
  }
}

export async function interpretAssessment(
  assessment: AssessmentData,
  filename: string
): Promise<string> {
  try {
    const prompt = `I've analyzed your laptop ${filename} and here are the results:

Grade: ${assessment.grade}
Confidence: ${Math.round(assessment.confidence * 100)}%
Overall Condition: ${assessment.overallCondition}
Processing Time: ${assessment.processingTime.toFixed(2)}s
${assessment.mediaType === 'video' ? `Video Analysis (${assessment.videoMetadata?.duration}s duration)` : 'Image Analysis'}

Damage Types: ${assessment.damageTypes.join(', ') || 'None detected'}

Detailed Findings:
${assessment.detailedFindings.map(finding => 
  `• ${finding.category} (${finding.severity}): ${finding.description}`
).join('\n')}

Please provide a conversational interpretation of these results. Explain what the grade means, highlight key concerns, and provide practical advice for the user. Keep it friendly and accessible.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a laptop diagnostic expert. Interpret assessment results in a conversational, friendly way. Focus on practical implications and recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400
    });

    return response.choices[0].message.content || "I've completed the analysis, but couldn't generate a detailed interpretation.";
  } catch (error) {
    console.error('Assessment interpretation error:', error);
    return "I've analyzed your laptop, but encountered an issue generating the detailed interpretation. The assessment results are still valid.";
  }
}