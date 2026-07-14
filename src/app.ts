import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { DB } from './db';
import { UserService } from './services/userService';
import { UrlService } from './services/urlService';
import { createAuthRouter } from './routes/auth';
import { createLinksRouter, ReachabilityChecker } from './routes/links';
import { createRedirectRouter } from './routes/redirect';
import { createRequireAuth } from './middleware/requireAuth';
import { errorHandler } from './middleware/errorHandler';
import { checkUrlReachable } from './utils/checkUrlReachable';
import { openApiSpec } from './openapi';

export function createApp(db: DB, baseUrl = 'http://localhost:3000', checkReachable: ReachabilityChecker = checkUrlReachable) {
  const app = express();
  app.use(express.json());

  const userService = new UserService(db);
  const urlService = new UrlService(db);
  const requireAuth = createRequireAuth(userService);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Mounted ahead of the GET /:code catch-all so these paths are never
  // mistaken for short codes.
  app.get('/openapi.json', (_req, res) => res.status(200).json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/auth', createAuthRouter(userService));
  app.use(createLinksRouter(urlService, requireAuth, baseUrl, checkReachable));
  app.use(createRedirectRouter(urlService));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
