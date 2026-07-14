const linkSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', example: '4c93' },
    shortUrl: { type: 'string', example: 'http://localhost:3000/4c93' },
    originalUrl: { type: 'string', example: 'https://example.com/some/long/path' },
    isCustom: { type: 'boolean' },
    clickCount: { type: 'integer', example: 0 },
    createdAt: { type: 'string', format: 'date-time', nullable: true },
    updatedAt: { type: 'string', format: 'date-time', nullable: true },
    lastAccessedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'URL Shortener & Link Analytics API',
    version: '1.0.0',
    description:
      'Shorten URLs with collision-free codes or a custom alias, redirect visitors, ' +
      'and view per-user click analytics. See /docs for the interactive explorer.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key returned by /auth/signup or /auth/login, sent as `Authorization: Bearer <apiKey>`.',
      },
    },
    schemas: {
      Link: linkSchema,
      Error: errorSchema,
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Meta'],
        responses: {
          '200': {
            description: 'Service is up',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } },
          },
        },
      },
    },
    '/auth/signup': {
      post: {
        summary: 'Create an account',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: { 'application/json': { schema: { type: 'object', properties: { apiKey: { type: 'string' } } } } },
          },
          '400': { description: 'Invalid email or password', content: { 'application/json': { schema: errorSchema } } },
          '409': { description: 'Email already registered', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Log in and retrieve the API key',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Same API key issued at signup',
            content: { 'application/json': { schema: { type: 'object', properties: { apiKey: { type: 'string' } } } } },
          },
          '401': { description: 'Invalid email or password', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/shorten': {
      post: {
        summary: 'Create a short link',
        tags: ['Links'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: { type: 'string', format: 'uri', example: 'https://example.com/some/long/path' },
                  customAlias: { type: 'string', minLength: 3, maxLength: 32, example: 'my-alias' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Link created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    linkSchema,
                    {
                      type: 'object',
                      properties: {
                        alreadyExisted: { type: 'boolean' },
                        warning: {
                          type: 'string',
                          nullable: true,
                          description: 'Present if the destination did not respond to a reachability probe. The link is created regardless.',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '200': { description: 'Same URL was already shortened by this user (idempotent)', content: { 'application/json': { schema: linkSchema } } },
          '400': { description: 'Invalid URL or alias', content: { 'application/json': { schema: errorSchema } } },
          '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: errorSchema } } },
          '409': { description: 'Custom alias already taken', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/{code}': {
      get: {
        summary: 'Redirect to the original URL',
        tags: ['Links'],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '301': { description: 'Redirects to the original URL; increments the click count' },
          '404': { description: 'Unknown code', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/api/links': {
      get: {
        summary: "List the caller's own links",
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'All links owned by the caller',
            content: { 'application/json': { schema: { type: 'object', properties: { links: { type: 'array', items: linkSchema } } } } },
          },
          '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/api/links/{code}': {
      get: {
        summary: "Get one of the caller's own links",
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Link detail', content: { 'application/json': { schema: linkSchema } } },
          '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: errorSchema } } },
          '404': { description: "Unknown code, or the code isn't owned by the caller", content: { 'application/json': { schema: errorSchema } } },
        },
      },
      patch: {
        summary: "Update a link's destination URL",
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['url'], properties: { url: { type: 'string', format: 'uri' } } },
            },
          },
        },
        responses: {
          '200': { description: 'Updated link', content: { 'application/json': { schema: linkSchema } } },
          '400': { description: 'Invalid URL', content: { 'application/json': { schema: errorSchema } } },
          '401': { description: 'Missing or invalid API key', content: { 'application/json': { schema: errorSchema } } },
          '404': { description: "Unknown code, or the code isn't owned by the caller", content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
  },
};
