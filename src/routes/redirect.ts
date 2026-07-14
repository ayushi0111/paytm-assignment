import { Router } from 'express';
import { UrlService } from '../services/urlService';

export function createRedirectRouter(urlService: UrlService): Router {
  const router = Router();

  router.get('/:code', (req, res) => {
    const record = urlService.recordClickAndGet(req.params.code);
    if (!record) {
      res.status(404).json({ error: 'Short code not found' });
      return;
    }
    res.redirect(301, record.original_url);
  });

  return router;
}
