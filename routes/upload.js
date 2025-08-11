/**
 * DELETE /api/upload
 * Delete all documents and their associated files
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const Document = require('../models/Document');
const { extractTextFromDocument, cleanText } = require('../utils/textExtractor');
const { getMemoryStorage } = require('../utils/memoryStorage');
const { generateRecommendedQuestions } = require('../services/geminiService');

const router = express.Router();

router.delete('/', async (req, res) => {
  try {
    const documents = await Document.find({});
    for (const document of documents) {
      try {
        await fs.promises.unlink(document.filePath);
      } catch (fileError) {
        // Ignore file errors (file may not exist)
      }
    }
    await Document.deleteMany({});
    res.json({ success: true, message: 'All documents deleted successfully' });
  } catch (error) {
    console.error('Delete all documents error:', error);
    res.status(500).json({ error: 'Failed to delete all documents', message: error.message });
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File filter to accept only specific document types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Word documents, and text files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

/**
 * POST /api/upload
 * Upload a document and extract its text content
 */
router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please select a document to upload' 
      });
    }

  console.log('File uploaded:', req.file.originalname);

    // Extract text from the uploaded document
    let extractedText = '';
    try {
      console.log('🔍 Starting text extraction for:', req.file.originalname, 'Type:', req.file.mimetype);
      extractedText = await extractTextFromDocument(req.file.path, req.file.mimetype);
  // Extraction debug (trimmed)
  console.log('Text length:', extractedText ? extractedText.length : 0);
      
      extractedText = cleanText(extractedText);
  console.log('Cleaned text length:', extractedText ? extractedText.length : 0);
      
      if (!extractedText || extractedText.trim().length === 0) {
  console.error('Text extraction resulted in empty content');
        throw new Error('Document appears to be empty or contains no readable text');
      }
    } catch (extractionError) {
      console.error('❌ Text extraction failed:', extractionError);
      // Clean up the uploaded file if text extraction fails
      try {
        await fsExtra.remove(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError);
      }
      return res.status(400).json({
        error: 'Text extraction failed',
        message: extractionError.message
      });
    }

    // Save document information to database
    const document = new Document({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      extractedText: extractedText
    });

    await document.save();

    res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      document: {
        id: document._id,
        originalName: document.originalName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        textLength: extractedText.length,
        uploadedAt: document.uploadedAt
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up uploaded file if there's an error
    if (req.file && req.file.path) {
      try {
        await fsExtra.remove(req.file.path);
      } catch (cleanupError) {
        console.error('File cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

/**
 * GET /api/upload/documents
 * Get list of uploaded documents
 */
router.get('/documents', async (req, res) => {
  try {
    const documents = await Document.find()
      .select('_id originalName fileSize mimeType uploadedAt')
      .sort({ uploadedAt: -1 })
      .limit(50);

    res.json({
      success: true,
      documents: documents
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message
    });
  }
});

/**
 * DELETE /api/upload/:id
 * Delete a document and its associated file
 */
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    // Remove the physical file
    try {
      await fsExtra.remove(document.filePath);
    } catch (fileError) {
      console.error('Error removing file:', fileError);
    }

    // Remove from database
    await Document.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

// Get dynamic recommended questions for a document
router.get('/:id/recommended-questions', async (req, res) => {
  try {
    const documentId = req.params.id;
    
    // Find document
    let document;
    if (global.useMemoryStorage) {
      const memoryStorage = getMemoryStorage();
      document = memoryStorage.documents.find(doc => doc.id === documentId);
    } else {
      document = await Document.findById(documentId);
    }

    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    // Generate dynamic recommended questions
    const questions = await generateRecommendedQuestions(document.extractedText);
    
    res.json({
      success: true,
      questions: questions
    });

  } catch (error) {
    console.error('Recommended questions error:', error);
    res.status(500).json({
      error: 'Failed to generate recommended questions',
      message: error.message
    });
  }
});

module.exports = router;
