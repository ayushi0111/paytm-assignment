import { Router, RequestHandler } from 'express';
import { UrlService } from '../services/urlService';
import { UrlRecord } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { checkUrlReachable } from '../utils/checkUrlReachable';

export type ReachabilityChecker = (url: string) => Promise<boolean>;

export function serializeLink(record: UrlRecord, baseUrl: string) {
  return {
    code: record.code,
    shortUrl: `${baseUrl}/${record.code}`,
    originalUrl: record.original_url,
    isCustom: Boolean(record.is_custom),
    clickCount: record.click_count,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastAccessedAt: record.last_accessed_at,
  };
}

export function createLinksRouter(
  urlService: UrlService,
  requireAuth: RequestHandler,
  baseUrl: string,
  checkReachable: ReachabilityChecker = checkUrlReachable
): Router {
  const router = Router();

  router.post(
    '/shorten',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { url, customAlias } = req.body ?? {};
      const { record, alreadyExisted } = urlService.shorten(req.userId!, url, customAlias);

      const body: Record<string, unknown> = { ...serializeLink(record, baseUrl), alreadyExisted };

      // Only probe on first creation - an idempotent re-shorten shouldn't
      // re-trigger an outbound network call on every duplicate call.
      if (!alreadyExisted && !(await checkReachable(record.original_url))) {
        body.warning = 'The destination URL could not be reached; the link was created anyway.';
      }

      res.status(alreadyExisted ? 200 : 201).json(body);
    })
  );

  router.get(
    '/api/links',
    requireAuth,
    asyncHandler(async (req, res) => {
      const links = urlService.listByOwner(req.userId!).map((record) => serializeLink(record, baseUrl));
      res.status(200).json({ links });
    })
  );

  router.get(
    '/api/links/:code',
    requireAuth,
    asyncHandler(async (req, res) => {
      const record = urlService.getByCodeForOwner(req.userId!, req.params.code);
      res.status(200).json(serializeLink(record, baseUrl));
    })
  );

  router.patch(
    '/api/links/:code',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { url } = req.body ?? {};
      const record = urlService.update(req.userId!, req.params.code, url);
      res.status(200).json(serializeLink(record, baseUrl));
    })
  );

  return router;
}
