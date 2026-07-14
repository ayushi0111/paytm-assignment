import { Router } from 'express';
import { UserService } from '../services/userService';
import { asyncHandler } from '../utils/asyncHandler';

export function createAuthRouter(userService: UserService): Router {
  const router = Router();

  router.post(
    '/signup',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {};
      const result = await userService.signup(email, password);
      res.status(201).json(result);
    })
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {};
      const result = await userService.login(email, password);
      res.status(200).json(result);
    })
  );

  return router;
}
