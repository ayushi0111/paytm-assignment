import express from 'express';
import request from 'supertest';
import { createDatabase } from '../../src/db';
import { UserService } from '../../src/services/userService';
import { createRequireAuth } from '../../src/middleware/requireAuth';

function buildApp() {
  const db = createDatabase(':memory:');
  const userService = new UserService(db);
  const app = express();
  app.use(express.json());
  app.get('/protected', createRequireAuth(userService), (req, res) => {
    res.json({ userId: req.userId });
  });
  return { app, userService };
}

describe('requireAuth middleware', () => {
  it('rejects requests with no Authorization header', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('rejects an unknown API key', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('attaches userId and calls next for a valid API key', async () => {
    const { app, userService } = buildApp();
    const { apiKey } = await userService.signup('user@example.com', 'password123');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${apiKey}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toEqual(expect.any(Number));
  });
});
