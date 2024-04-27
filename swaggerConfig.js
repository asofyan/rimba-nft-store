// swaggerConfig.js
module.exports = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'Rimba NFT Store API',
        version: '1.0.0',
        description: 'API documentation for the Rimba NFT Store.',
      },
      servers: [
        {
          url: 'http://localhost:3000', // Base URL for your backend server
        },
      ],
    },
    apis: ['./routes/*.js'], // Path to your API route files for Swagger to scan
  };
  