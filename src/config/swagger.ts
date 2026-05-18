import path from 'path';
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
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'VALIDATION_FAILED' },
                message: { type: 'string', example: 'Request validation failed' },
                details: { nullable: true },
                requestId: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Validation or malformed request',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        InternalError: {
          description: 'Internal server error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ServiceUnavailable: {
          description: 'Dependency degraded',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../modules/**/*.routes.{ts,js}')],
};

export const swaggerSpec = swaggerJsdoc(options);
