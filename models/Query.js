const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  queryText: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Query', querySchema);
