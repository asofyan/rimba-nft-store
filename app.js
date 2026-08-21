const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importing route handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const nftRoutes = require('./routes/nftRoutes');
const walletRoutes = require('./routes/walletRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Pastikan direktori uploads & metadata ada
for (const dir of ['uploads', 'metadata']) {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
}

// Middleware
app.use(express.json());
// Web3 v4 mengembalikan BigInt — konversi otomatis ke string saat serialisasi JSON
app.set('json replacer', (key, value) => (typeof value === 'bigint' ? value.toString() : value));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Rate limit authentication endpoints (brute-force protection)
// Dinonaktifkan saat test agar tidak saling mengganggu antar test suite
if (process.env.NODE_ENV !== 'test') {
  const authLimiter = require('express-rate-limit')({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' }
  });
  app.use('/login', authLimiter);
  app.use('/register', authLimiter);
}

// Swagger configuration
const swaggerConfig = require('./swaggerConfig');
const swaggerSpec = swaggerJsdoc(swaggerConfig);

// Serve Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the uploads and metadata directories
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/metadata', express.static(path.join(__dirname, 'metadata')));

// Use the imported routes
app.use('', authRoutes);
app.use('/api', userRoutes);
app.use('/api', nftRoutes);
app.use('/api', walletRoutes);

// Error handler terpusat (paling akhir)
app.use(errorHandler);

module.exports = app;
