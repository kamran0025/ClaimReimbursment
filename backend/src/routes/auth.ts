import { Router } from 'express';
import { login, signToken } from '../services/authService';
import { setAuthCookie, clearAuthCookie } from '../lib/cookies';
import { serializeUser } from '../services/serializers';
import { authenticate } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { loginSchema } from '../validation/authValidation';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../types/api';

export const authRouter = Router();

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await login(email, password);
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.json(ok(serializeUser(user)));
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json(ok(null));
});

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(ok(serializeUser(req.user!)));
  }),
);
