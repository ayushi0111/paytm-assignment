import express from 'express';
import request from 'supertest';
import { createDatabase } from '../../src/db';
import { UserService } from '../../src/services/userService';
import { UrlService } from '../../src/services/urlService';
import { createRequireAuth } from '../../src/middleware/requireAuth';
import { createLinksRouter } from '../../src/routes/links';

async function buildApp(checkReachable: (url: string) => Promise<boolean>) {
  const db = createDatabase(':memory:');
  const userService = new UserService(db);
  const urlService = new UrlService(db);
  const requireAuth = createRequireAuth(userService);

  const app = express();
  app.use(express.json());
  app.use(createLinksRouter(urlService, requireAuth, 'http://localhost:3000', checkReachable));

  const { apiKey } = await userService.signup('user@example.com', 'password123');
  return { app, apiKey };
}

describe('POST /shorten reachability warning', () => {
  it('creates the link and adds a warning when the destination is unreachable', async () => {
    const { app, apiKey } = await buildApp(async () => false);

    const res = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://example.com/maybe-down' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBeTruthy();
    expect(res.body.warning).toMatch(/could not be reached/i);
  });

  it('creates the link with no warning when the destination is reachable', async () => {
    const { app, apiKey } = await buildApp(async () => true);

    const res = await request(app)
      .post('/shorten')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'https://example.com/up' });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBeUndefined();
  });

  it('does not re-probe reachability on an idempotent duplicate shorten', async () => {
    const checker = jest.fn().mockResolvedValue(true);
    const { app, apiKey } = await buildApp(checker);

    await request(app).post('/shorten').set('Authorization', `Bearer ${apiKey}`).send({ url: 'https://example.com/dup' });
    await request(app).post('/shorten').set('Authorization', `Bearer ${apiKey}`).send({ url: 'https://example.com/dup' });

    expect(checker).toHaveBeenCalledTimes(1);
  });
});
