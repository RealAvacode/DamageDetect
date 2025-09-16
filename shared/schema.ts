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
