const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process query against document text using OpenAI
 * @param {string} documentText - Extracted text from document
 * @param {string} userQuery - User's query
 * @returns {Promise<Object>} - Response with answer and confidence
 */
async function processQueryWithOpenAI(documentText, userQuery) {
  try {
    const startTime = Date.now();
    
    // Create a comprehensive prompt for OpenAI
    const prompt = `
You are an AI assistant that analyzes documents and answers questions based on their content.

Document Content:
"""
${documentText}
"""

User Query: "${userQuery}"

Instructions:
1. Analyze the document content carefully
2. Determine if the query can be answered based on the document
3. If the information is available, provide a clear and accurate answer
4. If the information is not available, clearly state that it cannot be determined from the document
5. Provide a confidence level (0-1) for your answer
6. Be concise but thorough in your response

Please respond in the following JSON format:
{
  "answer": "Your detailed answer here",
  "canAnswer": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of how you arrived at this answer"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes documents and provides accurate answers based on their content. Always respond in valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3, // Lower temperature for more consistent responses
    });

    const processingTime = Date.now() - startTime;
    const responseText = completion.choices[0].message.content;

    // Try to parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      // If JSON parsing fails, create a fallback response
      parsedResponse = {
        answer: responseText,
        canAnswer: true,
        confidence: 0.7,
        reasoning: "Response generated but not in expected JSON format"
      };
    }

    return {
      ...parsedResponse,
      processingTime,
      tokensUsed: completion.usage?.total_tokens || 0
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    } else if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    } else {
      throw new Error(`OpenAI processing failed: ${error.message}`);
    }
  }
}

/**
 * Validate OpenAI API key
 * @returns {Promise<boolean>} - True if API key is valid
 */
async function validateOpenAIKey() {
  try {
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('OpenAI API key validation failed:', error);
    return false;
  }
}

module.exports = {
  processQueryWithOpenAI,
  validateOpenAIKey
};
