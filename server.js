const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

// Importing route handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const nftRoutes = require('./routes/nftRoutes');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Swagger configuration
const swaggerConfig = require('./swaggerConfig');
const swaggerSpec = swaggerJsdoc(swaggerConfig);

// Serve Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use the imported routes
app.use('', authRoutes);  
app.use('/api', userRoutes);  
app.use('/api', nftRoutes);  

// Connect to MongoDB
mongoose.connect('mongodb://localhost/rimba-nft-store').then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
