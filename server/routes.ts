import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { assessLaptopDamage, assessLaptopDamageFromVideo, fileToBase64 } from "./ai-assessment";
import { insertAssessmentSchema, chatMessageSchema, interpretAssessmentSchema } from "@shared/schema";
import { handleChatMessage, interpretAssessment } from "./chat-handler";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Allow both image and video files
    const allowedImageTypes = /^image\/(jpeg|jpg|png|gif|webp|bmp|tiff)$/i;
    const allowedVideoTypes = /^video\/(mp4|webm|mov|avi|mkv|quicktime|x-msvideo|x-matroska)$/i;
    
    console.log(`File upload: ${file.originalname}, MIME type: ${file.mimetype}`);
    
    // Also check for common alternative MIME types
    const isVideo = allowedVideoTypes.test(file.mimetype) || 
                   file.mimetype === 'application/mp4' ||
                   file.mimetype === 'video/x-mp4' ||
                   (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(mp4|webm|mov|avi|mkv)$/i));
    
    if (allowedImageTypes.test(file.mimetype) || isVideo) {
      cb(null, true);
    } else {
      console.log(`Rejected file: ${file.originalname} with MIME type: ${file.mimetype}`);
      cb(new Error(`Only image files (JPEG, PNG, GIF, WebP, BMP, TIFF) and video files (MP4, WebM, MOV, AVI, MKV) are allowed. Got: ${file.mimetype}`));
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
          message: 'Maximum 5 files allowed per upload.'
        });
      }
      if (error.message.includes('Only image files') || error.message.includes('Only video files')) {
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

      // Get the first file for analysis
      const file = files[0];
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = file.mimetype.startsWith('video/') || 
                     file.mimetype === 'application/mp4' ||
                     file.mimetype === 'video/x-mp4' ||
                     (file.mimetype === 'application/octet-stream' && file.originalname.match(/\.(mp4|webm|mov|avi|mkv)$/i));
      
      console.log(`Processing file: ${file.originalname}, MIME: ${file.mimetype}, isImage: ${isImage}, isVideo: ${isVideo}`);
      
      if (!isImage && !isVideo) {
        return res.status(400).json({ error: 'Invalid file type' });
      }
      
      let aiResult;
      
      if (isImage) {
        // Process image file
        const imageBase64 = fileToBase64(file.buffer);
        aiResult = await assessLaptopDamage(imageBase64);
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

      // Create assessment record
      const assessmentData = {
        sku: `AUTO-${Date.now()}`, // Generate SKU if not provided
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

      res.json({
        success: true,
        assessment: {
          ...assessment,
          ...aiResult
        }
      });

    } catch (error) {
      console.error('Assessment error:', error);
      res.status(500).json({ 
        error: 'Assessment failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
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
  app.post('/api/chat/interpret-assessment', async (req, res) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
