import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env';

describe('loadConfig', () => {
  const valid = { DATABASE_URL: 'sqlite::memory:', JWT_SECRET: 'y'.repeat(32) };

  it('applies defaults', () => {
    expect(loadConfig(valid)).toMatchObject({ PORT: 3000, BCRYPT_ROUNDS: 12, ACCESS_TOKEN_TTL_SECONDS: 900 });
  });

  it('refuses to start with a weak JWT secret', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('refuses to start without a database url', () => {
    expect(() => loadConfig({ JWT_SECRET: valid.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });
});
