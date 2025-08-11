const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Configure allowed origins via env (comma-separated), with sensible local defaults
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173'
];
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    // Allow all if '*' present
    if (allowedOrigins.includes('*')) return callback(null, true);
    // Exact match
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Support simple wildcard entries like *.vercel.app
    const ok = allowedOrigins.some(o => {
      if (o.startsWith('*.')) {
        const base = o.slice(1); // remove leading '*'
        return origin.endsWith(base);
      }
      return false;
    });
    if (ok) return callback(null, true);
    return callback(new Error('CORS blocked: ' + origin), false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Load environment variables
dotenv.config();

// Import routes
const uploadRoutes = require('./routes/upload');
const queryRoutes = require('./routes/query');

const app = express();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploaded documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/query', queryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// MongoDB connection with fallback
let useMemoryStorage = false;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
})
.then(() => {
  console.log('Connected to MongoDB');
  useMemoryStorage = false;
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  console.log('Falling back to in-memory storage...');
  useMemoryStorage = true;
});

// Make storage type available to routes
app.locals.useMemoryStorage = () => useMemoryStorage;

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: error.message 
  });
});

// Root welcome (optional)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
