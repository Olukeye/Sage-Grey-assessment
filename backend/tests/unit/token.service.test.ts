import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { TokenService } from '../../src/modules/auth/auth.token.service';

const service = new TokenService({ JWT_SECRET: 'x'.repeat(40), ACCESS_TOKEN_TTL_SECONDS: 60 });

describe('TokenService', () => {
  it('round-trips an access token', () => {
    expect(service.verifyAccessToken(service.signAccessToken('user-1'))).toEqual({ sub: 'user-1' });
  });

  it('rejects tampered tokens', () => {
    const token = service.signAccessToken('user-1');
    expect(() => service.verifyAccessToken(`${token}x`)).toThrow(/invalid or has expired/);
  });

  it('rejects tokens with no subject', () => {
    const token = jwt.sign({}, 'x'.repeat(40));
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('generates unique, high-entropy refresh tokens whose hash is stable', () => {
    const a = service.generateRefreshToken();
    const b = service.generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(64);
    expect(service.hashRefreshToken(a.token)).toBe(a.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
