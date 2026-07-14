import request from 'supertest';
import { createDatabase } from '../../src/db';
import { createApp } from '../../src/app';

function buildApp() {
  return createApp(createDatabase(':memory:'), 'http://localhost:3000', async () => true);
}

describe('GET /openapi.json', () => {
  it('serves a valid OpenAPI 3.0 document describing every route', async () => {
    const res = await request(buildApp()).get('/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/auth/signup', '/auth/login', '/shorten', '/{code}', '/api/links', '/api/links/{code}'])
    );
  });
});

describe('GET /docs', () => {
  it('serves the Swagger UI page', async () => {
    const res = await request(buildApp()).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger-ui/i);
  });
});
