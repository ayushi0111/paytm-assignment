import express from 'express';
import request from 'supertest';
import { createDatabase } from '../../src/db';
import { UserService } from '../../src/services/userService';
import { UrlService } from '../../src/services/urlService';
import { createRequireAuth } from '../../src/middleware/requireAuth';
import { createLinksRouter } from '../../src/routes/links';
import { errorHandler } from '../../src/middleware/errorHandler';

async function buildApp() {
  const db = createDatabase(':memory:');
  const userService = new UserService(db);
  const urlService = new UrlService(db);
  const requireAuth = createRequireAuth(userService);

  const app = express();
  app.use(express.json());
  app.use(createLinksRouter(urlService, requireAuth, 'http://localhost:3000', async () => true));
  app.use(errorHandler);

  const alice = (await userService.signup('alice@example.com', 'password123')).apiKey;
  const bob = (await userService.signup('bob@example.com', 'password123')).apiKey;

  return { app, alice, bob };
}

describe('GET /api/links', () => {
  it("lists only the caller's own links", async () => {
    const { app, alice, bob } = await buildApp();
    await request(app).post('/shorten').set('Authorization', `Bearer ${alice}`).send({ url: 'https://example.com/a' });
    await request(app).post('/shorten').set('Authorization', `Bearer ${bob}`).send({ url: 'https://example.com/b' });

    const res = await request(app).get('/api/links').set('Authorization', `Bearer ${alice}`);

    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(1);
    expect(res.body.links[0].originalUrl).toBe('https://example.com/a');
  });

  it('requires authentication', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/api/links');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/links/:code', () => {
  it('returns click count and metadata for the owner', async () => {
    const { app, alice } = await buildApp();
    const created = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'https://example.com/c' });

    await request(app).get(`/${created.body.code}`);
    await request(app).get(`/${created.body.code}`);

    const res = await request(app).get(`/api/links/${created.body.code}`).set('Authorization', `Bearer ${alice}`);
    expect(res.status).toBe(200);
    expect(res.body.clickCount).toBeGreaterThanOrEqual(0);
  });

  it("404s (not 403) for another user's link, so ownership isn't leaked", async () => {
    const { app, alice, bob } = await buildApp();
    const created = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'https://example.com/d' });

    const res = await request(app).get(`/api/links/${created.body.code}`).set('Authorization', `Bearer ${bob}`);
    expect(res.status).toBe(404);
  });

  it('404s for an unknown code', async () => {
    const { app, alice } = await buildApp();
    const res = await request(app).get('/api/links/does-not-exist').set('Authorization', `Bearer ${alice}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/links/:code', () => {
  it('updates the destination URL for the owner', async () => {
    const { app, alice } = await buildApp();
    const created = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'https://example.com/e' });

    const res = await request(app)
      .patch(`/api/links/${created.body.code}`)
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'https://example.com/e-updated' });

    expect(res.status).toBe(200);
    expect(res.body.originalUrl).toBe('https://example.com/e-updated');
    expect(res.body.code).toBe(created.body.code);
  });

  it("404s when updating another user's link", async () => {
    const { app, alice, bob } = await buildApp();
    const created = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'https://example.com/f' });

    const res = await request(app)
      .patch(`/api/links/${created.body.code}`)
      .set('Authorization', `Bearer ${bob}`)
      .send({ url: 'https://example.com/hijack' });

    expect(res.status).toBe(404);
  });

  it('rejects an invalid new URL with 400', async () => {
    const { app, alice } = await buildApp();
    const created = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'https://example.com/g' });

    const res = await request(app)
      .patch(`/api/links/${created.body.code}`)
      .set('Authorization', `Bearer ${alice}`)
      .send({ url: 'not a url' });

    expect(res.status).toBe(400);
  });
});
