import type { Express } from 'express';
import type { Knex } from 'knex';
import request from 'supertest';
import { createApp } from '../../src/app';
import type { Config } from '../../src/config/env';
import { createDb } from '../../src/db/connection';
import { migrationSource } from '../../src/db/migrationSource';

export const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'sqlite::memory:',
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 7,
  BCRYPT_ROUNDS: 4, // fast hashing in tests
  AUTH_RATE_LIMIT_MAX: 1000,
  CORS_ORIGIN: 'http://localhost:5173',
};

export interface TestContext {
  app: Express;
  db: Knex;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestContext(overrides: Partial<Config> = {}): Promise<TestContext> {
  const config = { ...testConfig, ...overrides };
  const db = createDb(config.DATABASE_URL);
  await db.migrate.latest({ migrationSource });
  return {
    app: createApp(db, config),
    db,
    reset: async () => {
      for (const table of ['transactions', 'refresh_tokens', 'accounts', 'users']) await db(table).delete();
    },
    close: () => db.destroy(),
  };
}

export interface RegisteredUser {
  accessToken: string;
  refreshToken: string;
  userId: string;
  accountNumber: string;
  bearer: string;
}

let counter = 0;

export async function registerUser(app: Express, overrides: Record<string, unknown> = {}): Promise<RegisteredUser> {
  counter += 1;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email: `user${counter}@example.com`, fullName: `Test User ${counter}`, password: 'Passw0rd!x', ...overrides });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    accessToken: res.body.tokens.accessToken,
    refreshToken: res.body.tokens.refreshToken,
    userId: res.body.user.id,
    accountNumber: res.body.account.accountNumber,
    bearer: `Bearer ${res.body.tokens.accessToken}`,
  };
}

export async function fund(app: Express, user: RegisteredUser, amount: number) {
  return request(app).post('/api/v1/account/fund').set('Authorization', user.bearer).send({ amount });
}
