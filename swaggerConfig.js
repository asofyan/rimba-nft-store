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
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
            },
            username: {
              type: 'string',
              description: 'Username of the user',
            },
            password: {
              type: 'string',
              description: 'User password',
            },
            role: {
              type: 'string',
              description: 'Role of the user',
            },
            isActive: {
              type: 'boolean',
              description: 'Status of the user account',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date of the user',
            },
          },
        },
        NFT: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'NFT ID',
            },
            ownerId: {
              type: 'string',
              description: 'Owner User ID',
            },
            name: {
              type: 'string',
              description: 'Name of the NFT',
            },
            description: {
              type: 'string',
              description: 'Description of the NFT',
            },
            imageUrl: {
              type: 'string',
              description: 'URL of the NFT image',
            },
            bidPrice: {
              type: 'number',
              description: 'Bid price of the NFT',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date of the NFT',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API docs
};
