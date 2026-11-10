import type { RequestHandler } from 'express';
import { unauthorized } from '../../shared/errors';
import type { TokenService } from './token.service';

export function createAuthenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw unauthorized('UNAUTHENTICATED', 'Send an Authorization: Bearer <token> header.');
    }
    req.userId = tokens.verifyAccessToken(token).sub;
    next();
  };
}
