import { 
  type User, type InsertUser, 
  type Assessment, type InsertAssessment,
  type Conversation, type InsertConversation,
  type ConversationMessage, type InsertConversationMessage,
  users, assessments, conversations, conversationMessages 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, or, and } from "drizzle-orm";

// Assessment-related interfaces for storage
export interface AssessmentSearchFilters {
  grades?: string[];
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Assessment methods
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  getAllAssessments(): Promise<Assessment[]>;
  searchAssessments(filters: AssessmentSearchFilters): Promise<Assessment[]>;
  updateAssessment(id: string, updates: Partial<InsertAssessment>): Promise<Assessment | undefined>;

  // Conversation methods
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;

  // Conversation message methods
  addMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  deleteMessage(id: string): Promise<boolean>;
}

// DatabaseStorage implementation based on javascript_database blueprint
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [result] = await db
      .insert(assessments)
      .values(assessment)
      .returning();
    return result;
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, id));
    return assessment || undefined;
  }

  async getAllAssessments(): Promise<Assessment[]> {
    return await db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.assessmentDate));
  }

  async searchAssessments(filters: AssessmentSearchFilters): Promise<Assessment[]> {
    const conditions = [];
    
    // Filter by grades
    if (filters.grades && filters.grades.length > 0) {
      conditions.push(or(...filters.grades.map(grade => eq(assessments.grade, grade))));
    }

    // Search by SKU, brand, model
    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      conditions.push(
        or(
          like(assessments.sku, searchTerm),
          like(assessments.brand, searchTerm),
          like(assessments.model, searchTerm)
        )
      );
    }

    // Add date filters if needed
    if (filters.startDate || filters.endDate) {
      // TODO: Implement date filtering
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(assessments)
        .where(and(...conditions))
        .orderBy(desc(assessments.assessmentDate));
    }

    return await db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.assessmentDate));
  }

  async updateAssessment(id: string, updates: Partial<InsertAssessment>): Promise<Assessment | undefined> {
    const [updated] = await db
      .update(assessments)
      .set(updates)
      .where(eq(assessments.id, id))
      .returning();
    return updated || undefined;
  }

  // Conversation management methods
  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    return conversation;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getAllConversations(): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
  }

  async updateConversation(id: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();
    return result.length > 0;
  }

  // Conversation message methods
  async addMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [result] = await db
      .insert(conversationMessages)
      .values(message)
      .returning();
    
    // Update conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, message.conversationId));
      
    return result;
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.timestamp);
  }

  async deleteMessage(id: string): Promise<boolean> {
    const result = await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
