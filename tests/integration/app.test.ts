import request from 'supertest';
import { createDatabase } from '../../src/db';
import { createApp } from '../../src/app';

function buildApp() {
  const db = createDatabase(':memory:');
  return createApp(db, 'http://localhost:3000', async () => true);
}

describe('URL shortener app (integration)', () => {
  it('GET /health returns ok', async () => {
    const res = await request(buildApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('supports the full signup -> shorten -> redirect -> dashboard -> update flow', async () => {
    const app = buildApp();

    const signup = await request(app)
      .post('/auth/signup')
      .send({ email: 'flow@example.com', password: 'password123' });
    expect(signup.status).toBe(201);
    const { apiKey } = signup.body;

    const shorten = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://example.com/long/path' });
    expect(shorten.status).toBe(201);
    const { code } = shorten.body;

    const redirect = await request(app).get(`/${code}`).redirects(0);
    expect(redirect.status).toBe(301);
    expect(redirect.headers.location).toBe('https://example.com/long/path');

    const dashboard = await request(app).get('/api/links').set('Authorization', `Bearer ${apiKey}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.links).toHaveLength(1);
    expect(dashboard.body.links[0].clickCount).toBe(1);

    const updated = await request(app)
      .patch(`/api/links/${code}`)
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://example.com/moved' });
    expect(updated.status).toBe(200);
    expect(updated.body.originalUrl).toBe('https://example.com/moved');

    const redirectAfterUpdate = await request(app).get(`/${code}`).redirects(0);
    expect(redirectAfterUpdate.headers.location).toBe('https://example.com/moved');
  });

  it('logs back in and gets the same api key issued at signup', async () => {
    const app = buildApp();
    const signup = await request(app)
      .post('/auth/signup')
      .send({ email: 'relog@example.com', password: 'password123' });
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'relog@example.com', password: 'password123' });

    expect(login.status).toBe(200);
    expect(login.body.apiKey).toBe(signup.body.apiKey);
  });

  it('rejects shorten requests with no auth', async () => {
    const res = await request(buildApp()).post('/shorten').send({ url: 'https://example.com' });
    expect(res.status).toBe(401);
  });

  it('returns 409 for a duplicate custom alias', async () => {
    const app = buildApp();
    const { body } = await request(app)
      .post('/auth/signup')
      .send({ email: 'alias@example.com', password: 'password123' });

    await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${body.apiKey}`)
      .send({ url: 'https://example.com/x', customAlias: 'promo' });

    const res = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${body.apiKey}`)
      .send({ url: 'https://example.com/y', customAlias: 'promo' });

    expect(res.status).toBe(409);
  });

  it('returns 404 JSON for an unknown short code', async () => {
    const res = await request(buildApp()).get('/does-not-exist-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 404 JSON for a completely unmatched route', async () => {
    const res = await request(buildApp()).get('/deeply/nested/unknown/path');
    expect(res.status).toBe(404);
  });

  it('returns 400 (not 500) for a malformed JSON request body', async () => {
    const app = buildApp();
    const { body } = await request(app)
      .post('/auth/signup')
      .send({ email: 'malformed@example.com', password: 'password123' });

    const res = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${body.apiKey}`)
      .set('Content-Type', 'application/json')
      .send('{"url": "https://example.com/"'); // missing closing brace - invalid JSON

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid JSON/i);
  });

  it('creates the link with a warning when the destination is syntactically valid but unreachable', async () => {
    const db = createDatabase(':memory:');
    const app = createApp(db, 'http://localhost:3000', async () => false);

    const { body: signup } = await request(app)
      .post('/auth/signup')
      .send({ email: 'unreachable@example.com', password: 'password123' });

    const res = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${signup.apiKey}`)
      .send({ url: 'http://gfsagaasgre.com/' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBeTruthy();
    expect(res.body.warning).toMatch(/could not be reached/i);
  });
});
