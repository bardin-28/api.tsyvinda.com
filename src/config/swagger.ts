import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './app.config';

const serverUrl = `https://${config.backendHost}`;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API',
      version: '1.0.0',
    },
    servers: [{ url: serverUrl }],
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
