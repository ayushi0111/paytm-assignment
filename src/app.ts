import express, { NextFunction, Request, Response } from 'express';
import { DB } from './db';
import { UserService } from './services/userService';
import { UrlService } from './services/urlService';
import { createAuthRouter } from './routes/auth';
import { createLinksRouter, ReachabilityChecker } from './routes/links';
import { createRedirectRouter } from './routes/redirect';
import { createRequireAuth } from './middleware/requireAuth';
import { checkUrlReachable } from './utils/checkUrlReachable';
import { ConflictError, InvalidInputError, NotFoundError, UnauthorizedError } from './errors';

export function createApp(db: DB, baseUrl = 'http://localhost:3000', checkReachable: ReachabilityChecker = checkUrlReachable) {
  const app = express();
  app.use(express.json());

  const userService = new UserService(db);
  const urlService = new UrlService(db);
  const requireAuth = createRequireAuth(userService);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/auth', createAuthRouter(userService));
  app.use(createLinksRouter(urlService, requireAuth, baseUrl, checkReachable));
  app.use(createRedirectRouter(urlService));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof InvalidInputError) return void res.status(400).json({ error: err.message });
    if (err instanceof UnauthorizedError) return void res.status(401).json({ error: err.message });
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    if (err instanceof ConflictError) return void res.status(409).json({ error: err.message });

    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
