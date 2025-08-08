const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Google Generative AI client
let genAI;
let model;

function initializeGemini() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }
  
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Try different models in order of preference
  try {
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (error) {
    console.warn('Failed to load gemini-1.5-flash, trying gemini-pro');
    model = genAI.getGenerativeModel({ model: "gemini-pro" });
  }
}

/**
 * Process query against document text using Google Gemini
 * @param {string} documentText - Extracted text from document
 * @param {string} userQuery - User's query
 * @returns {Promise<Object>} - Response with answer and confidence
 */
async function processQueryWithGemini(documentText, userQuery) {
  try {
    // Initialize Gemini if not already done
    if (!model) {
      initializeGemini();
    }

    const startTime = Date.now();
    
    // Create an optimized, concise prompt for faster processing
    const prompt = `Document: ${documentText.substring(0, 2000)}${documentText.length > 2000 ? '...' : ''}

Question: ${userQuery}

Answer this question based on the document content. Respond in JSON format:
{"answer": "your answer", "canAnswer": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    // Add retry logic for overloaded API
    let result, response, responseText;
    let retries = 3;
    
    while (retries > 0) {
      try {
        result = await model.generateContent(prompt);
        response = await result.response;
        responseText = response.text();
        break; // Success, exit retry loop
      } catch (apiError) {
        console.warn(`Gemini API attempt failed (${4 - retries}/3):`, apiError.message);
        
        if (apiError.message.includes('overloaded') && retries > 1) {
          // Wait before retrying for overloaded API
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
          continue;
        } else {
          // Re-throw non-retryable errors or final attempt
          throw apiError;
        }
      }
    }

    const processingTime = Date.now() - startTime;

    // Try to parse the JSON response
    let parsedResponse;
    try {
      // Clean the response text (remove any markdown formatting)
      const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn('JSON parsing failed, creating fallback response:', parseError);
      // If JSON parsing fails, create a fallback response
      parsedResponse = {
        answer: responseText,
        canAnswer: true,
        confidence: 0.7,
        reasoning: "Response generated but not in expected JSON format"
      };
    }

    // Ensure required fields exist
    parsedResponse.answer = parsedResponse.answer || responseText;
    parsedResponse.canAnswer = parsedResponse.canAnswer !== undefined ? parsedResponse.canAnswer : true;
    parsedResponse.confidence = parsedResponse.confidence || 0.7;
    parsedResponse.reasoning = parsedResponse.reasoning || "Analysis completed";

    return {
      ...parsedResponse,
      processingTime,
      tokensUsed: estimateTokens(prompt + responseText) // Rough estimation
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Handle specific Gemini errors with better messages
    if (error.message.includes('API_KEY')) {
      throw new Error('Invalid Gemini API key. Please check your configuration.');
    } else if (error.message.includes('quota')) {
      throw new Error('Gemini API quota exceeded. Please try again later.');
    } else if (error.message.includes('SAFETY')) {
      throw new Error('Content was blocked by Gemini safety filters. Please try a different query.');
    } else if (error.message.includes('overloaded')) {
      // Provide a fallback response when API is overloaded
      console.warn('Gemini API is overloaded, providing fallback response');
      return {
        answer: `I apologize, but the AI service is currently overloaded. However, I can see that you're asking: "${userQuery}". Please try again in a few moments, or try rephrasing your question. The document appears to contain relevant information that I could analyze once the service is available.`,
        canAnswer: false,
        confidence: 0.0,
        reasoning: "Gemini API is temporarily overloaded",
        processingTime: Date.now() - (Date.now() - 1000),
        tokensUsed: 0
      };
    } else {
      throw new Error(`Gemini processing failed: ${error.message}`);
    }
  }
}

/**
 * Validate Gemini API key
 * @returns {Promise<boolean>} - True if API key is valid
 */
async function validateGeminiKey() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return false;
    }

    initializeGemini();
    
    // Test with a simple query
    const result = await model.generateContent("Hello, this is a test.");
    const response = await result.response;
    await response.text();
    
    return true;
  } catch (error) {
    console.error('Gemini API key validation failed:', error);
    return false;
  }
}

/**
 * Rough token estimation for Gemini (approximate)
 * @param {string} text - Text to estimate tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokens(text) {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Get model information
 * @returns {Object} - Model details
 */
function getModelInfo() {
  return {
    name: "gemini-pro",
    provider: "Google",
    maxTokens: 30720, // Gemini Pro context window
    pricing: "Free tier: 60 requests/minute, 1500 requests/day"
  };
}

/**
 * Generate recommended questions based on document content
 * @param {string} documentText - Extracted text from document
 * @returns {Promise<Array>} - Array of recommended questions
 */
async function generateRecommendedQuestions(documentText) {
  try {
    if (!model) {
      initializeGemini();
    }

    // Use a shorter text sample for faster processing
    const textSample = documentText.substring(0, 1000);
    
    const prompt = `Based on this document excerpt: "${textSample}"

Generate 3 relevant questions that would help someone understand this document better. Respond in JSON format:
{"questions": ["question 1", "question 2", "question 3"]}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    try {
      const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      return parsed.questions || [
        "What is the main topic of this document?",
        "Can you summarize the key points?",
        "What are the most important findings?"
      ];
    } catch (parseError) {
      console.warn('Failed to parse recommended questions, using defaults');
      return [
        "What is the main topic of this document?",
        "Can you summarize the key points?", 
        "What are the most important findings?"
      ];
    }
  } catch (error) {
    console.error('Error generating recommended questions:', error);
    return [
      "What is the main topic of this document?",
      "Can you summarize the key points?",
      "What are the most important findings?"
    ];
  }
}

module.exports = {
  processQueryWithGemini,
  validateGeminiKey,
  generateRecommendedQuestions
};
