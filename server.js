const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const corsOptions = {
  origin: 'https://query-fy.vercel.app/', // ⬅️ Replace this with your actual frontend URL!
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

// app.use('/', (req, res) => {
//   res.send('Welcome to the API');
// });

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
