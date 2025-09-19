import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Laptop assessment table
export const assessments = pgTable("assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku"), // SKU/ID for the laptop
  brand: text("brand"), 
  model: text("model"),
  grade: text("grade").notNull(), // A, B, C, D, PENDING
  confidence: real("confidence"), // 0-1 confidence score
  damageDescription: text("damage_description"),
  detailedFindings: json("detailed_findings"), // Array of finding objects
  damageTypes: json("damage_types"), // Array of damage type strings
  imageUrl: text("image_url"),
  processingTime: real("processing_time"), // Time taken for AI processing
  assessmentDate: timestamp("assessment_date", { withTimezone: true }).notNull().defaultNow(),
  fileType: text("file_type"), // 'image' or 'video'
  originalFileName: text("original_file_name"), // Original uploaded filename
  mimeType: text("mime_type"), // MIME type of uploaded file
  fileSize: real("file_size"), // File size in bytes
  // Video metadata fields
  videoDuration: real("video_duration"), // Video duration in seconds
  videoWidth: real("video_width"), // Video width in pixels
  videoHeight: real("video_height"), // Video height in pixels
  videoFps: real("video_fps"), // Video frames per second
  framesAnalyzed: real("frames_analyzed"), // Number of frames extracted and analyzed
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  id: true,
  assessmentDate: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

// Shared types for chatbot functionality
export interface AssessmentData {
  grade: "A" | "B" | "C" | "D" | "PENDING";
  confidence: number;
  damageTypes: string[];
  overallCondition: string;
  detailedFindings: {
    category: string;
    severity: "Low" | "Medium" | "High";
    description: string;
  }[];
  processingTime: number;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  videoMetadata?: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    framesAnalyzed: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  assessment?: AssessmentData;
  files?: { name: string; type: string }[];
  isUploading?: boolean;
}

// Zod schemas for chat endpoints
export const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.date().or(z.string()).transform(val => new Date(val))
  })).optional()
});

export const interpretAssessmentSchema = z.object({
  assessment: z.object({
    grade: z.enum(["A", "B", "C", "D", "PENDING"]),
    confidence: z.number().min(0).max(1),
    damageTypes: z.array(z.string()),
    overallCondition: z.string(),
    detailedFindings: z.array(z.object({
      category: z.string(),
      severity: z.enum(["Low", "Medium", "High"]),
      description: z.string()
    })),
    processingTime: z.number(),
    mediaUrl: z.string(),
    mediaType: z.enum(['image', 'video']).optional(),
    videoMetadata: z.object({
      duration: z.number(),
      width: z.number(),
      height: z.number(),
      fps: z.number(),
      framesAnalyzed: z.number()
    }).optional()
  }),
  filename: z.string().optional()
});

export type ChatMessageRequest = z.infer<typeof chatMessageSchema>;
export type InterpretAssessmentRequest = z.infer<typeof interpretAssessmentSchema>;
