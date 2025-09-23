import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { assessLaptopDamage, assessLaptopDamageFromVideo, fileToBase64 } from "./ai-assessment";
import { insertAssessmentSchema, chatMessageSchema, interpretAssessmentSchema } from "@shared/schema";
import { handleChatMessage, interpretAssessment } from "./chat-handler";
import express from "express"; // Import express to use express.Router

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Allow both image and video files
    const allowedImageTypes = /^image\/(jpeg|jpg|png|gif|webp|bmp|tiff|heic|heif)$/i;
    const allowedVideoTypes = /^video\/(mp4|webm|mov|avi|mkv|quicktime|x-msvideo|x-matroska)$/i;

    console.log(`File upload: ${file.originalname}, MIME type: ${file.mimetype}`);

    // Also check for common alternative MIME types and HEIC files
    const isVideo = allowedVideoTypes.test(file.mimetype) || 
                   file.mimetype === 'application/mp4' ||
                   file.mimetype === 'video/x-mp4' ||
                   (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(mp4|webm|mov|avi|mkv)$/i));

    const isImage = allowedImageTypes.test(file.mimetype) ||
                   // Handle HEIC files that may appear as application/octet-stream
                   (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(heic|heif)$/i));

    if (isImage || isVideo) {
      cb(null, true);
    } else {
      console.log(`Rejected file: ${file.originalname} with MIME type: ${file.mimetype}`);
      cb(new Error(`Only image files (JPEG, PNG, GIF, WebP, BMP, TIFF, HEIC) and video files (MP4, WebM, MOV, AVI, MKV) are allowed. Got: ${file.mimetype}`));
    }
  }
});

// Configure multer for multiple file uploads
const uploadMultiple = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/') || 
                   (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(heic|heif)$/i));
    const isVideo = file.mimetype.startsWith('video/');

    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported. Please upload images (JPEG, PNG, WebP, HEIC) or videos (MP4, WebM, MOV).`));
    }
  }
});


export async function registerRoutes(app: Express): Promise<Server> {
  // Multer error handling middleware
  const handleMulterError = (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
          error: 'File too large', 
          message: 'File size must be less than 50MB. Please choose a smaller file.'
        });
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ 
          error: 'Too many files', 
          message: 'Maximum 10 files allowed per upload.'
        });
      }
      if (error.message.includes('Only image files') || error.message.includes('Only video files') || error.message.includes('File type')) {
        return res.status(400).json({ 
          error: 'Invalid file type', 
          message: error.message 
        });
      }
      return res.status(400).json({ 
        error: 'File upload error', 
        message: error.message || 'Unknown upload error'
      });
    }
    next();
  };

  // Assessment routes

  // Upload and assess laptop images/videos
  app.post('/api/assessments', upload.array('files', 5), handleMulterError, async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = [];
      
      // Process all uploaded files
      for (const file of files) {
        try {
          const isImage = file.mimetype.startsWith('image/') || 
                         // Handle HEIC files which sometimes appear as application/octet-stream
                         (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(heic|heif)$/i));
          const isVideo = file.mimetype.startsWith('video/') || 
                         file.mimetype === 'application/mp4' ||
                         file.mimetype === 'video/x-mp4' ||
                         (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(mp4|webm|mov|avi|mkv)$/i));

          console.log(`Processing file: ${file.originalname}, MIME: ${file.mimetype}, isImage: ${isImage}, isVideo: ${isVideo}`);

          if (!isImage && !isVideo) {
            results.push({
              originalFileName: file.originalname,
              success: false,
              error: 'Invalid file type'
            });
            continue;
          }

          // Validate minimum file size for images
          if (isImage && file.size < 100) { // Minimum 100 bytes - very permissive
            results.push({
              originalFileName: file.originalname,
              success: false,
              error: 'Image file appears to be corrupted or empty.'
            });
            continue;
          }

          let aiResult;

          if (isImage) {
            // Process image file
            const imageBase64 = fileToBase64(file.buffer);
            aiResult = await assessLaptopDamage(imageBase64, file.mimetype);
          } else {
            // Process video file using frame extraction and AI analysis
            try {
              aiResult = await assessLaptopDamageFromVideo(file.buffer);
            } catch (videoError) {
              console.error('Video processing failed:', videoError);
              // Fallback assessment for video processing failures
              aiResult = {
                grade: 'C' as const,
                confidence: 0.3,
                overallCondition: `Video processing failed: ${videoError instanceof Error ? videoError.message : 'Unknown error'}`,
                damageTypes: ['Video Processing Error'],
                detailedFindings: [{
                  category: 'Overall Structure' as const,
                  severity: 'Medium' as const,
                  description: `Video assessment could not be completed automatically. Error: ${videoError instanceof Error ? videoError.message : 'Unknown error'}. Manual review required.`
                }],
                processingTime: 0.1
              };
            }
          }

          // Create assessment record with unique SKU per file
          const assessmentData = {
            sku: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique SKU per file
            brand: null,
            model: null,
            grade: aiResult.grade,
            confidence: aiResult.confidence,
            damageDescription: aiResult.overallCondition,
            detailedFindings: aiResult.detailedFindings,
            damageTypes: aiResult.damageTypes,
            imageUrl: null, // TODO: Store in object storage
            fileType: isImage ? 'image' : 'video',
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            processingTime: aiResult.processingTime,
            // Video metadata fields (null for images)
            videoDuration: aiResult.videoMetadata?.duration || null,
            videoWidth: aiResult.videoMetadata?.width || null,
            videoHeight: aiResult.videoMetadata?.height || null,
            videoFps: aiResult.videoMetadata?.fps || null,
            framesAnalyzed: aiResult.videoMetadata?.framesAnalyzed || null
          };

          const assessment = await storage.createAssessment(assessmentData);
          
          results.push({
            originalFileName: file.originalname,
            success: true,
            assessment: {
              ...assessment,
              ...aiResult
            }
          });
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({
            originalFileName: file.originalname,
            success: false,
            error: fileError instanceof Error ? fileError.message : 'Unknown processing error'
          });
        }
      }

      res.json({
        success: true,
        results: results
      });

    } catch (error) {
      console.error('Assessment error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        fullError: error
      });

      // Provide more specific error messages based on error type
      let userMessage = 'Unknown error';
      if (error instanceof Error) {
        userMessage = error.message;

        // Additional context for common error types
        if (error.message.includes('OPENAI_API_KEY')) {
          userMessage = 'AI service configuration error. Please contact support.';
        } else if (error.message.includes('database') || error.message.includes('storage')) {
          userMessage = 'Database error occurred while saving assessment. Please try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          userMessage = 'Network error occurred. Please check your connection and try again.';
        }
      }

      res.status(500).json({ 
        error: 'Assessment failed', 
        message: userMessage
      });
    }
  });

  // Batch assessment endpoint for multiple files
  app.post('/api/assessments/batch', uploadMultiple.array('files', 10), handleMulterError, async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = [];
      for (const file of files) {
        try {
          const isImage = file.mimetype.startsWith('image/') || 
                         (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(heic|heif)$/i));
          const isVideo = file.mimetype.startsWith('video/');

          console.log(`Processing file: ${file.originalname}, MIME: ${file.mimetype}, isImage: ${isImage}, isVideo: ${isVideo}`);

          if (!isImage && !isVideo) {
            results.push({
              originalFileName: file.originalname,
              success: false,
              error: 'Invalid file type'
            });
            continue;
          }

          // Validate minimum file size for images
          if (isImage && file.size < 100) { // Minimum 100 bytes - very permissive
            results.push({
              originalFileName: file.originalname,
              success: false,
              error: 'Image file appears to be corrupted or empty.'
            });
            continue;
          }

          let aiResult;

          if (isImage) {
            // Process image file
            const imageBase64 = fileToBase64(file.buffer);
            aiResult = await assessLaptopDamage(imageBase64, file.mimetype);
          } else {
            // Process video file using frame extraction and AI analysis
            try {
              aiResult = await assessLaptopDamageFromVideo(file.buffer);
            } catch (videoError) {
              console.error('Video processing failed:', videoError);
              aiResult = {
                grade: 'C' as const,
                confidence: 0.3,
                overallCondition: `Video processing failed: ${videoError instanceof Error ? videoError.message : 'Unknown error'}`,
                damageTypes: ['Video Processing Error'],
                detailedFindings: [{
                  category: 'Overall Structure' as const,
                  severity: 'Medium' as const,
                  description: `Video assessment could not be completed automatically. Error: ${videoError instanceof Error ? videoError.message : 'Unknown error'}. Manual review required.`
                }],
                processingTime: 0.1
              };
            }
          }

          // Create assessment record with unique SKU per file
          const assessmentData = {
            sku: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique SKU per file
            brand: null,
            model: null,
            grade: aiResult.grade,
            confidence: aiResult.confidence,
            damageDescription: aiResult.overallCondition,
            detailedFindings: aiResult.detailedFindings,
            damageTypes: aiResult.damageTypes,
            imageUrl: null, // TODO: Store in object storage
            fileType: isImage ? 'image' : 'video',
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            processingTime: aiResult.processingTime,
            // Video metadata fields (null for images)
            videoDuration: aiResult.videoMetadata?.duration || null,
            videoWidth: aiResult.videoMetadata?.width || null,
            videoHeight: aiResult.videoMetadata?.height || null,
            videoFps: aiResult.videoMetadata?.fps || null,
            framesAnalyzed: aiResult.videoMetadata?.framesAnalyzed || null
          };

          const assessment = await storage.createAssessment(assessmentData);
          results.push({
            originalFileName: file.originalname,
            success: true,
            assessment: {
              ...assessment,
              ...aiResult
            }
          });
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({
            originalFileName: file.originalname,
            success: false,
            error: fileError instanceof Error ? fileError.message : 'Unknown processing error'
          });
        }
      }

      res.json({
        success: true,
        results: results
      });

    } catch (error) {
      console.error('Batch assessment error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError',
        fullError: error
      });

      let userMessage = 'Unknown error';
      if (error instanceof Error) {
        userMessage = error.message;
        if (error.message.includes('OPENAI_API_KEY')) {
          userMessage = 'AI service configuration error. Please contact support.';
        } else if (error.message.includes('database') || error.message.includes('storage')) {
          userMessage = 'Database error occurred while saving assessment. Please try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          userMessage = 'Network error occurred. Please check your connection and try again.';
        }
      }

      res.status(500).json({ 
        error: 'Batch assessment failed', 
        message: userMessage
      });
    }
  });


  // Get all assessments
  app.get('/api/assessments', async (req, res) => {
    try {
      const assessments = await storage.getAllAssessments();
      res.json(assessments);
    } catch (error) {
      console.error('Error fetching assessments:', error);
      res.status(500).json({ error: 'Failed to fetch assessments' });
    }
  });

  // Search assessments
  app.get('/api/assessments/search', async (req, res) => {
    try {
      const { grades, q: searchQuery } = req.query;

      const filters: any = {};

      if (grades) {
        filters.grades = Array.isArray(grades) ? grades : [grades];
      }

      if (searchQuery) {
        filters.searchQuery = searchQuery as string;
      }

      const results = await storage.searchAssessments(filters);
      res.json(results);
    } catch (error) {
      console.error('Error searching assessments:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Get single assessment
  app.get('/api/assessments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const assessment = await storage.getAssessment(id);

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error fetching assessment:', error);
      res.status(500).json({ error: 'Failed to fetch assessment' });
    }
  });

  // Chat routes

  // General chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const validationResult = chatMessageSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const { message, conversationHistory } = validationResult.data;
      const response = await handleChatMessage(message, conversationHistory || []);

      res.json({ response });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ 
        error: 'Chat failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Assessment interpretation endpoint
  app.post('/api/chat/interpret-assessment', async (req: Request, res: Response) => {
    try {
      const validationResult = interpretAssessmentSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const { assessment, filename } = validationResult.data;
      const response = await interpretAssessment(assessment, filename || 'uploaded file');

      res.json({ response });
    } catch (error) {
      console.error('Assessment interpretation error:', error);
      res.status(500).json({ 
        error: 'Assessment interpretation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Conversation management routes

  // Get all conversations
  app.get('/api/conversations', async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Create new conversation
  app.post('/api/conversations', async (req, res) => {
    try {
      const { title } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Valid title is required' });
      }

      const conversation = await storage.createConversation({ title: title.trim() });
      res.json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  });

  // Get specific conversation with messages
  app.get('/api/conversations/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const messages = await storage.getConversationMessages(id);

      res.json({
        ...conversation,
        messages
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // Add message to conversation
  app.post('/api/conversations/:id/messages', async (req, res) => {
    try {
      const { id } = req.params;
      const { role, content, assessmentData, fileData } = req.body;

      if (!role || !content) {
        return res.status(400).json({ error: 'Role and content are required' });
      }

      if (!['user', 'assistant'].includes(role)) {
        return res.status(400).json({ error: 'Role must be either "user" or "assistant"' });
      }

      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const message = await storage.addMessage({
        conversationId: id,
        role,
        content,
        assessmentData: assessmentData || null,
        fileData: fileData || null
      });

      res.json(message);
    } catch (error) {
      console.error('Error adding message:', error);
      res.status(500).json({ error: 'Failed to add message' });
    }
  });

  // Update conversation title
  app.patch('/api/conversations/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Valid title is required' });
      }

      const conversation = await storage.updateConversation(id, { title: title.trim() });
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json(conversation);
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  });

  // Delete conversation
  app.delete('/api/conversations/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteConversation(id);
      if (!success) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}