import { NextFunction, Request, Response } from 'express';
import { ConflictError, InvalidInputError, NotFoundError, UnauthorizedError } from '../errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // express.json() throws this when the request body isn't valid JSON
  // (body-parser tags the SyntaxError with a `body` property) - a bad
  // request, not a server fault, so it must not fall through to the 500 below.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  if (err instanceof InvalidInputError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
