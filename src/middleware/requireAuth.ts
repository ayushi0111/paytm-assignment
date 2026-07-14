import { NextFunction, Request, Response } from 'express';
import { UserService } from '../services/userService';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

export function createRequireAuth(userService: UserService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header('Authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const user = userService.findByApiKey(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.userId = user.id;
    next();
  };
}
