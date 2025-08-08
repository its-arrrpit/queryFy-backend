const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from various document types
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromDocument(filePath, mimeType) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    switch (mimeType) {
      case 'application/pdf':
        return await extractFromPDF(fileBuffer);
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return await extractFromWord(fileBuffer);
      
      case 'text/plain':
        return fileBuffer.toString('utf-8');
      
      default:
        // Try to read as text file for other formats
        try {
          return fileBuffer.toString('utf-8');
        } catch (error) {
          throw new Error(`Unsupported file type: ${mimeType}`);
        }
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from PDF files
 * @param {Buffer} fileBuffer - File buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractFromPDF(fileBuffer) {
  try {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from Word documents
 * @param {Buffer} fileBuffer - File buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractFromWord(fileBuffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`Word document extraction failed: ${error.message}`);
  }
}

/**
 * Clean and normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespaces with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .trim();
}

module.exports = {
  extractTextFromDocument,
  cleanText
};
