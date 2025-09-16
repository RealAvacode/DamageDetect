import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
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
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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
      const imageBase64 = fileToBase64(imageFile.buffer);

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
