import { Router, type RequestHandler } from 'express';
import type { AuthService } from './auth.service';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas';

export function createAuthRouter(
  service: AuthService,
  authenticate: RequestHandler,
  rateLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post('/register', rateLimiter, async (req, res) => {
    const result = await service.register(registerSchema.parse(req.body));
    res.status(201).json(result);
  });

  router.post('/login', rateLimiter, async (req, res) => {
    res.json(await service.login(loginSchema.parse(req.body)));
  });

  router.post('/refresh', rateLimiter, async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json({ tokens: await service.refresh(refreshToken) });
  });

  router.post('/logout', async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await service.logout(refreshToken);
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req, res) => {
    res.json(await service.getProfile(req.userId!));
  });

  return router;
}
