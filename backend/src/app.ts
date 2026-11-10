import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Knex } from 'knex';
import type { Config } from './config/env';
import { AuthRepository } from './modules/auth/auth.repository';
import { createAuthenticate } from './modules/auth/auth.middleware';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { TokenService } from './modules/auth/auth.token.service';
import { WalletRepository } from './modules/wallet/wallet.repository';
import { createWalletRouter } from './modules/wallet/wallet.routes';
import { WalletService } from './modules/wallet/wallet.service';
import { errorHandler, notFoundHandler } from './shared/errorHandler';

export function createApp(db: Knex, config: Config): Express {
  const tokens = new TokenService(config);
  const walletService = new WalletService(db, new WalletRepository());
  const authService = new AuthService(db, config, new AuthRepository(), tokens, walletService);
  const authenticate = createAuthenticate(tokens);

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } });
    },
  });

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', async (_req, res) => {
    await db.raw('select 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', createAuthRouter(authService, authenticate, authRateLimiter));
  app.use('/api/v1/account', createWalletRouter(walletService, authenticate));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
