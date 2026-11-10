import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Config } from '../../config/env';
import { unauthorized } from '../../shared/errors';

export interface AccessTokenPayload {
  sub: string;
}

export class TokenService {
  constructor(private readonly config: Pick<Config, 'JWT_SECRET' | 'ACCESS_TOKEN_TTL_SECONDS'>) {}

  signAccessToken(userId: string): string {
    return jwt.sign({}, this.config.JWT_SECRET, {
      subject: userId,
      expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.config.JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub) throw new Error('Malformed payload');
      return { sub: payload.sub };
    } catch {
      throw unauthorized('INVALID_TOKEN', 'The access token is invalid or has expired.');
    }
  }

  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
