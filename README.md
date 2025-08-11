# QueryFy Backend

A powerful backend application that processes document uploads and answers queries using OpenAI's GPT models. Built with Express.js, MongoDB, and integrated with OpenAI API for intelligent document analysis.

## Features

- **Document Upload**: Support for PDF, Word documents (.docx, .doc), and text files
- **Text Extraction**: Automatic text extraction from uploaded documents
- **AI-Powered Queries**: Use OpenAI GPT models to answer questions based on document content
- **Query History**: Track and store all queries and responses
- **Batch Processing**: Process multiple queries against a single document
- **Statistics**: Get insights into query performance and confidence levels

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI Service**: OpenAI GPT-3.5-turbo
- **File Processing**: Multer for uploads, pdf-parse for PDFs, mammoth for Word docs
- **Environment**: dotenv for configuration

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- OpenAI API key

## Installation

1. Clone the repository and navigate to the backend directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
  PORT=5001
   MONGODB_URI=mongodb://localhost:27017/querify
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=development
   ```

4. Start MongoDB service on your machine

5. Run the application:
   ```bash
   # Development mode with nodemon
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Document Upload
- `POST /api/upload` - Upload a document (PDF, Word, or text file)
- `GET /api/upload/documents` - Get list of uploaded documents
- `DELETE /api/upload/:id` - Delete a document

### Query Processing
- `POST /api/query` - Process a single query against a document
- `POST /api/query/batch` - Process multiple queries against a document
- `GET /api/query/history/:documentId` - Get query history for a document
- `GET /api/query/stats` - Get overall query statistics

## API Usage Examples

### Upload a Document
```bash
curl -X POST http://localhost:5001/api/upload \
  -F "document=@/path/to/your/document.pdf"
```

### Query a Document
```bash
curl -X POST http://localhost:5001/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "document_id_here",
    "query": "What is the main topic of this document?"
  }'
```

## Response Format

### Successful Query Response
```json
{
  "success": true,
  "query": {
    "id": "query_id",
    "documentName": "document.pdf",
    "queryText": "What is the main topic?",
    "answer": "The main topic is...",
    "canAnswer": true,
    "confidence": 0.85,
    "reasoning": "Based on the document content...",
    "processingTime": 1500,
    "tokensUsed": 250,
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

## File Structure

```
backend/
├── models/
│   ├── Document.js      # Document schema
│   └── Query.js         # Query schema
├── routes/
│   ├── upload.js        # File upload endpoints
│   └── query.js         # Query processing endpoints
├── services/
│   └── openaiService.js # OpenAI API integration
├── utils/
│   └── textExtractor.js # Text extraction utilities
├── uploads/             # Uploaded files directory
├── .env                 # Environment variables
├── package.json         # Dependencies and scripts
├── server.js           # Main application file
└── README.md           # This file
```

## Environment Variables

- `PORT`: Server port (default: 5001)
- `MONGODB_URI`: MongoDB connection string
- `OPENAI_API_KEY`: Your OpenAI API key
- `NODE_ENV`: Environment (development/production)

## Error Handling

The API includes comprehensive error handling for:
- Invalid file types
- File size limits (10MB max)
- Text extraction failures
- OpenAI API errors
- Database connection issues
- Missing required parameters

## Security Considerations

- File type validation
- File size limits
- Input sanitization
- Error message sanitization
- API key protection

## Development

For development, use:
```bash
npm run dev
```

This will start the server with nodemon for automatic restarts on file changes.

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a production MongoDB instance
3. Implement proper logging and monitoring
4. Set up reverse proxy (nginx) if needed
5. Use PM2 or similar for process management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License
