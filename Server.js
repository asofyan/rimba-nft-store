const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const authRoutes = require('./routes/authRoutes'); // Import the route file

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

const swaggerConfig = require('./swaggerConfig');
const swaggerSpec = swaggerJsdoc(swaggerConfig);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Use the imported routes
app.use(authRoutes); // This will include the endpoints from authRoutes

// Connect to MongoDB
mongoose.connect('mongodb://localhost/rimba-nft-store', { useNewUrlParser: true, useUnifiedTopology: true });

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
