import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
// @ts-ignore - heic-convert doesn't have type definitions
import heicConvert from "heic-convert";
import { storage } from "./storage";
import { assessLaptopDamage, fileToBase64 } from "./ai-assessment";
import { insertAssessmentSchema } from "@shared/schema";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow image files and HEIC files
    if (file.mimetype.startsWith('image/') || file.mimetype === 'image/heic' || file.mimetype === 'image/heif' || file.originalname.toLowerCase().endsWith('.heic') || file.originalname.toLowerCase().endsWith('.heif')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (including HEIC/HEIF) are allowed'));
    }
  }
});

// Helper function to convert HEIC to JPEG
async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid buffer provided');
    }

    // Check if buffer starts with HEIC magic bytes
    const heicMagicBytes = buffer.slice(4, 12);
    const isValidHeic = heicMagicBytes.includes(Buffer.from('ftyp')) && 
                       (heicMagicBytes.includes(Buffer.from('heic')) || 
                        heicMagicBytes.includes(Buffer.from('heix')) ||
                        heicMagicBytes.includes(Buffer.from('heim')) ||
                        heicMagicBytes.includes(Buffer.from('heis')));

    if (!isValidHeic) {
      console.log('Buffer does not appear to be a valid HEIC file, magic bytes:', heicMagicBytes.toString('hex'));
      throw new Error('File does not appear to be a valid HEIC image');
    }

    console.log('Converting valid HEIC file to JPEG...');
    const outputBuffer = await heicConvert({
      buffer,
      format: 'JPEG',
      quality: 0.9
    });
    return outputBuffer as Buffer;
  } catch (error) {
    console.error('HEIC conversion error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to convert HEIC image: ${error.message}`);
    }
    throw new Error('Failed to convert HEIC image to JPEG');
  }
}

// Helper function to check if file is HEIC/HEIF
function isHeicFile(file: Express.Multer.File): boolean {
  return file.mimetype === 'image/heic' || 
         file.mimetype === 'image/heif' || 
         file.originalname.toLowerCase().endsWith('.heic') || 
         file.originalname.toLowerCase().endsWith('.heif');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Assessment routes
  
  // Upload and assess laptop images
  app.post('/api/assessments', upload.array('images', 5), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No images uploaded' });
      }

      // For now, analyze the first image
      const imageFile = files[0];
      console.log(`Processing file: ${imageFile.originalname}, type: ${imageFile.mimetype}, size: ${imageFile.size} bytes`);
      
      // Convert HEIC to JPEG if needed
      let processedBuffer = imageFile.buffer;
      if (isHeicFile(imageFile)) {
        console.log('Detected HEIC file, attempting conversion...');
        try {
          processedBuffer = await convertHeicToJpeg(imageFile.buffer);
          console.log('HEIC conversion successful');
        } catch (conversionError) {
          console.error('HEIC conversion failed:', conversionError);
          return res.status(400).json({ 
            error: 'HEIC conversion failed', 
            message: conversionError instanceof Error ? conversionError.message : 'Unknown conversion error'
          });
        }
      }
      
      const imageBase64 = fileToBase64(processedBuffer);

      // Perform AI assessment
      const aiResult = await assessLaptopDamage(imageBase64);

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
        processingTime: aiResult.processingTime
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

  const httpServer = createServer(app);

  return httpServer;
}
