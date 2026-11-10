import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, registerUser, testConfig, type TestContext } from './helpers/testApp';

describe('authentication', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());
  beforeEach(() => ctx.reset());

  const credentials = { email: 'ada@example.com', fullName: 'Ada Lovelace', password: 'Analytical1' };

  describe('POST /auth/register', () => {
    it('creates the user, a zero-balance account and a first session', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/register').send(credentials);

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email: 'ada@example.com', fullName: 'Ada Lovelace' });
      expect(res.body.account).toMatchObject({ balance: 0, currency: 'NGN' });
      expect(res.body.account.accountNumber).toMatch(/^\d{10}$/);
      expect(res.body.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
      expect(res.body.tokens.accessToken).toBeTruthy();
      expect(res.body.tokens.refreshToken).toBeTruthy();
    });

    it('never returns or stores the plaintext password', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/register').send(credentials);

      expect(JSON.stringify(res.body)).not.toContain('Analytical1');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      const row = await ctx.db('users').where({ email: 'ada@example.com' }).first();
      expect(row.password_hash).toMatch(/^\$2[aby]\$/);
      expect(row.password_hash).not.toContain('Analytical1');
    });

    it('stores only a hash of the refresh token', async () => {
      const res = await request(ctx.app).post('/api/v1/auth/register').send(credentials);
      const rows = await ctx.db('refresh_tokens');
      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).not.toBe(res.body.tokens.refreshToken);
    });

    it('rejects a duplicate email regardless of case', async () => {
      await request(ctx.app).post('/api/v1/auth/register').send(credentials);
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .send({ ...credentials, email: 'ADA@Example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
      expect(await ctx.db('accounts')).toHaveLength(1);
    });

    it.each([
      ['an invalid email', { email: 'not-an-email' }, 'email'],
      ['a short password', { password: 'abc1' }, 'password'],
      ['a password without digits', { password: 'abcdefghij' }, 'password'],
      ['a password without letters', { password: '1234567890' }, 'password'],
      ['a password over bcrypt’s 72-byte limit', { password: 'a1'.repeat(40) }, 'password'],
      ['a missing name', { fullName: '' }, 'fullName'],
    ])('rejects %s', async (_label, patch, field) => {
      const res = await request(ctx.app).post('/api/v1/auth/register').send({ ...credentials, ...patch });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    });

    it('rejects malformed JSON with a 400, not a 500', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(ctx.app).post('/api/v1/auth/register').send(credentials);
    });

    it('returns the user, account and fresh tokens', async () => {
      const res = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'Ada@example.com', password: credentials.password });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('ada@example.com');
      expect(res.body.account.accountNumber).toMatch(/^\d{10}$/);
      expect(res.body.tokens.accessToken).toBeTruthy();
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: 'Wrong-password1' });
      const unknownEmail = await request(ctx.app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'Wrong-password1' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user and account', async () => {
      const user = await registerUser(ctx.app);
      const res = await request(ctx.app).get('/api/v1/auth/me').set('Authorization', user.bearer);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.userId);
      expect(res.body.account.accountNumber).toBe(user.accountNumber);
    });

    it('rejects a missing token', async () => {
      const res = await request(ctx.app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects a garbage token', async () => {
      const res = await request(ctx.app).get('/api/v1/auth/me').set('Authorization', 'Bearer nonsense');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects an expired token', async () => {
      const user = await registerUser(ctx.app);
      const expired = jwt.sign({}, testConfig.JWT_SECRET, { subject: user.userId, expiresIn: -10 });
      const res = await request(ctx.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with another secret', async () => {
      const user = await registerUser(ctx.app);
      const forged = jwt.sign({}, 'a-completely-different-secret-value-123', { subject: user.userId });
      const res = await request(ctx.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });

    it('rejects an unsigned (alg=none) token', async () => {
      const user = await registerUser(ctx.app);
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.userId })}.`;
      const res = await request(ctx.app).get('/api/v1/auth/me').set('Authorization', `Bearer ${unsigned}`);
      expect(res.status).toBe(401);
    });
  });

  describe('refresh tokens', () => {
    it('rotates: returns a new pair and invalidates the old refresh token', async () => {
      const user = await registerUser(ctx.app);

      const first = await request(ctx.app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });
      expect(first.status).toBe(200);
      expect(first.body.tokens.refreshToken).not.toBe(user.refreshToken);

      const me = await request(ctx.app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${first.body.tokens.accessToken}`);
      expect(me.status).toBe(200);
    });

    it('treats reuse of a rotated token as theft and revokes the whole session family', async () => {
      const user = await registerUser(ctx.app);
      const rotated = await request(ctx.app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });

      const replay = await request(ctx.app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('TOKEN_REUSED');

      // The legitimate holder's newer token is revoked too.
      const descendant = await request(ctx.app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.tokens.refreshToken });
      expect(descendant.status).toBe(401);
    });

    it('rejects unknown and expired refresh tokens', async () => {
      const unknown = await request(ctx.app).post('/api/v1/auth/refresh').send({ refreshToken: 'nope' });
      expect(unknown.status).toBe(401);

      const user = await registerUser(ctx.app);
      await ctx.db('refresh_tokens').update({ expires_at: new Date(Date.now() - 1000) });
      const expired = await request(ctx.app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });
      expect(expired.status).toBe(401);
      expect(expired.body.error.code).toBe('INVALID_TOKEN');
    });

    it('logout revokes the session and is idempotent', async () => {
      const user = await registerUser(ctx.app);

      const out = await request(ctx.app).post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken });
      expect(out.status).toBe(204);
      const again = await request(ctx.app).post('/api/v1/auth/logout').send({ refreshToken: user.refreshToken });
      expect(again.status).toBe(204);

      const refresh = await request(ctx.app).post('/api/v1/auth/refresh').send({ refreshToken: user.refreshToken });
      expect(refresh.status).toBe(401);
    });
  });

  describe('platform behaviour', () => {
    it('rate-limits auth endpoints', async () => {
      const limited = await createTestContext({ AUTH_RATE_LIMIT_MAX: 2 });
      try {
        const attempt = () =>
          request(limited.app).post('/api/v1/auth/login').send({ email: 'a@example.com', password: 'whatever1' });
        expect((await attempt()).status).toBe(401);
        expect((await attempt()).status).toBe(401);
        const blocked = await attempt();
        expect(blocked.status).toBe(429);
        expect(blocked.body.error.code).toBe('RATE_LIMITED');
      } finally {
        await limited.close();
      }
    });

    it('serves a health check and a JSON 404', async () => {
      expect((await request(ctx.app).get('/health')).body).toEqual({ status: 'ok' });
      const missing = await request(ctx.app).get('/nope');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('NOT_FOUND');
    });
  });
});
