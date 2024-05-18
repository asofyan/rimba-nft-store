const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Importing route handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

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
app.use('/swagger-custom.js', express.static(path.join(__dirname, 'swagger-custom.js')));

// Use the imported routes
app.use('', authRoutes);  
app.use('/api', userRoutes);  

// Connect to MongoDB
mongoose.connect('mongodb://localhost/rimba-nft-store', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err.message);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
