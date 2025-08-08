const express = require('express');
const Document = require('../models/Document');
const Query = require('../models/Query');
const { processQueryWithGemini } = require('../services/geminiService');

const router = express.Router();

/**
 * POST /api/query
 * Process a query against a specific document
 */
router.post('/', async (req, res) => {
  try {
    const { documentId, query } = req.body;

    // Validate input
    if (!documentId || !query) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both documentId and query are required'
      });
    }

    if (query.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Query must be at least 3 characters long'
      });
    }

    // Find the document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The specified document does not exist'
      });
    }

    if (!document.extractedText || document.extractedText.trim().length === 0) {
      return res.status(400).json({
        error: 'No text content',
        message: 'The document has no extractable text content'
      });
    }

    console.log(`Processing query for document: ${document.originalName}`);
    console.log(`Query: ${query}`);

    // Process query with Gemini
    const startTime = Date.now();
    const aiResponse = await processQueryWithGemini(document.extractedText, query);
    const processingTime = Date.now() - startTime;

    // Save query and response to database
    const queryRecord = new Query({
      documentId: document._id,
      queryText: query,
      response: aiResponse.answer,
      confidence: aiResponse.confidence || 0.7,
      processingTime: processingTime
    });

    await queryRecord.save();

    // Return response to frontend
    res.json({
      success: true,
      query: {
        id: queryRecord._id,
        documentName: document.originalName,
        queryText: query,
        answer: aiResponse.answer,
        canAnswer: aiResponse.canAnswer,
        confidence: aiResponse.confidence,
        reasoning: aiResponse.reasoning,
        processingTime: processingTime,
        tokensUsed: aiResponse.tokensUsed || 0,
        createdAt: queryRecord.createdAt
      }
    });

  } catch (error) {
    console.error('Query processing error:', error);
    
    // Handle specific error types
    if (error.message.includes('Gemini')) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Query processing failed',
      message: error.message
    });
  }
});

/**
 * POST /api/query/batch
 * Process multiple queries against a document
 */
router.post('/batch', async (req, res) => {
  try {
    const { documentId, queries } = req.body;

    // Validate input
    if (!documentId || !queries || !Array.isArray(queries)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'documentId and queries array are required'
      });
    }

    if (queries.length === 0 || queries.length > 10) {
      return res.status(400).json({
        error: 'Invalid query count',
        message: 'Please provide between 1 and 10 queries'
      });
    }

    // Find the document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({
        error: 'Document not found'
      });
    }

    const results = [];
    
    // Process each query
    for (const query of queries) {
      try {
        const aiResponse = await processQueryWithGemini(document.extractedText, query);
        
        // Save to database
        const queryRecord = new Query({
          documentId: document._id,
          queryText: query,
          response: aiResponse.answer,
          confidence: aiResponse.confidence || 0.7,
          processingTime: aiResponse.processingTime || 0
        });

        await queryRecord.save();

        results.push({
          query: query,
          answer: aiResponse.answer,
          confidence: aiResponse.confidence,
          success: true
        });

      } catch (queryError) {
        console.error(`Error processing query "${query}":`, queryError);
        results.push({
          query: query,
          error: queryError.message,
          success: false
        });
      }
    }

    res.json({
      success: true,
      documentName: document.originalName,
      results: results
    });

  } catch (error) {
    console.error('Batch query error:', error);
    res.status(500).json({
      error: 'Batch processing failed',
      message: error.message
    });
  }
});

/**
 * GET /api/query/history/:documentId
 * Get query history for a specific document
 */
router.get('/history/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const queries = await Query.find({ documentId })
      .populate('documentId', 'originalName')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      queries: queries.map(q => ({
        id: q._id,
        queryText: q.queryText,
        response: q.response,
        confidence: q.confidence,
        processingTime: q.processingTime,
        createdAt: q.createdAt
      }))
    });

  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch query history',
      message: error.message
    });
  }
});

/**
 * GET /api/query/stats
 * Get overall query statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const totalQueries = await Query.countDocuments();
    const totalDocuments = await Document.countDocuments();
    
    const avgConfidence = await Query.aggregate([
      {
        $group: {
          _id: null,
          avgConfidence: { $avg: '$confidence' },
          avgProcessingTime: { $avg: '$processingTime' }
        }
      }
    ]);

    const recentQueries = await Query.find()
      .populate('documentId', 'originalName')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('queryText response confidence createdAt');

    res.json({
      success: true,
      stats: {
        totalQueries,
        totalDocuments,
        averageConfidence: avgConfidence[0]?.avgConfidence || 0,
        averageProcessingTime: avgConfidence[0]?.avgProcessingTime || 0,
        recentQueries
      }
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

module.exports = router;
