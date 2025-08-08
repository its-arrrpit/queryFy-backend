// In-memory storage fallback when MongoDB is not available
let documents = [];
let queries = [];
let nextDocId = 1;
let nextQueryId = 1;

const memoryStorage = {
  // Document operations
  async saveDocument(docData) {
    const document = {
      _id: `doc_${nextDocId++}`,
      id: `doc_${nextDocId - 1}`,
      ...docData,
      uploadedAt: new Date()
    };
    documents.push(document);
    return document;
  },

  async findDocuments() {
    return documents;
  },

  async findDocumentById(id) {
    return documents.find(doc => doc._id === id || doc.id === id);
  },

  async deleteDocument(id) {
    const index = documents.findIndex(doc => doc._id === id || doc.id === id);
    if (index > -1) {
      documents.splice(index, 1);
      // Also delete related queries
      queries = queries.filter(q => q.documentId !== id);
      return true;
    }
    return false;
  },

  // Query operations
  async saveQuery(queryData) {
    const query = {
      _id: `query_${nextQueryId++}`,
      id: `query_${nextQueryId - 1}`,
      ...queryData,
      createdAt: new Date()
    };
    queries.push(query);
    return query;
  },

  async findQueriesByDocumentId(documentId) {
    return queries.filter(q => q.documentId === documentId);
  },

  async findAllQueries() {
    return queries;
  },

  // Stats
  async getStats() {
    const totalQueries = queries.length;
    const totalDocuments = documents.length;
    const avgConfidence = queries.length > 0 
      ? queries.reduce((sum, q) => sum + (q.confidence || 0), 0) / queries.length 
      : 0;
    const avgProcessingTime = queries.length > 0 
      ? queries.reduce((sum, q) => sum + (q.processingTime || 0), 0) / queries.length 
      : 0;

    return {
      totalQueries,
      totalDocuments,
      avgConfidence,
      avgProcessingTime,
      recentQueries: queries.slice(-5)
    };
  },

  // Clear all data
  clearAll() {
    documents = [];
    queries = [];
    nextDocId = 1;
    nextQueryId = 1;
  }
};

module.exports = memoryStorage;
