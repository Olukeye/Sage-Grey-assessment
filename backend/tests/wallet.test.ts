import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, fund, registerUser, type RegisteredUser, type TestContext } from './helpers/testApp';

describe('wallet', () => {
  let ctx: TestContext;
  let alice: RegisteredUser;
  let bob: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());
  beforeEach(async () => {
    await ctx.reset();
    alice = await registerUser(ctx.app);
    bob = await registerUser(ctx.app);
  });

  const api = () => request(ctx.app);
  const balanceOf = async (user: RegisteredUser) =>
    (await api().get('/api/v1/account').set('Authorization', user.bearer)).body.account.balance as number;
  const withdraw = (user: RegisteredUser, amount: number) =>
    api().post('/api/v1/account/withdraw').set('Authorization', user.bearer).send({ amount });
  const transfer = (from: RegisteredUser, to: RegisteredUser, amount: number, extra: object = {}) =>
    api()
      .post('/api/v1/account/transfer')
      .set('Authorization', from.bearer)
      .send({ toAccountNumber: to.accountNumber, amount, ...extra });

  it('requires authentication on every wallet route', async () => {
    for (const [method, path] of [
      ['get', '/api/v1/account'],
      ['post', '/api/v1/account/fund'],
      ['post', '/api/v1/account/withdraw'],
      ['post', '/api/v1/account/transfer'],
      ['get', '/api/v1/account/transactions'],
    ] as const) {
      expect((await api()[method](path)).status, `${method} ${path}`).toBe(401);
    }
  });

  describe('funding', () => {
    it('credits the account and records a ledger entry', async () => {
      const res = await fund(ctx.app, alice, 50_000);

      expect(res.status).toBe(201);
      expect(res.body.balance).toBe(50_000);
      expect(res.body.transaction).toMatchObject({
        type: 'FUND',
        direction: 'CREDIT',
        amount: 50_000,
        balanceAfter: 50_000,
      });
      expect(await balanceOf(alice)).toBe(50_000);
    });

    it.each([
      ['zero', 0],
      ['a negative amount', -100],
      ['a fractional amount', 10.5],
      ['a string', '100'],
      ['more than the per-transaction maximum', 100_000_000_001],
      ['null', null],
    ])('rejects %s', async (_label, amount) => {
      const res = await fund(ctx.app, alice, amount as number);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await balanceOf(alice)).toBe(0);
    });

    it('does not credit the same request twice when an Idempotency-Key is reused', async () => {
      const send = () =>
        api()
          .post('/api/v1/account/fund')
          .set('Authorization', alice.bearer)
          .set('Idempotency-Key', 'fund-001')
          .send({ amount: 1_000 });

      const first = await send();
      const retry = await send();

      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
      expect(retry.headers['idempotent-replay']).toBe('true');
      expect(retry.body.transaction.id).toBe(first.body.transaction.id);
      expect(await balanceOf(alice)).toBe(1_000);
    });

    it('scopes idempotency keys to the account', async () => {
      const send = (user: RegisteredUser) =>
        api().post('/api/v1/account/fund').set('Authorization', user.bearer).set('Idempotency-Key', 'shared-key').send({ amount: 500 });
      expect((await send(alice)).status).toBe(201);
      expect((await send(bob)).status).toBe(201);
    });
  });

  describe('withdrawing', () => {
    it('debits the account', async () => {
      await fund(ctx.app, alice, 10_000);
      const res = await withdraw(alice, 3_000);

      expect(res.status).toBe(201);
      expect(res.body.transaction).toMatchObject({ type: 'WITHDRAWAL', direction: 'DEBIT', amount: 3_000 });
      expect(await balanceOf(alice)).toBe(7_000);
    });

    it('allows withdrawing the exact balance', async () => {
      await fund(ctx.app, alice, 2_500);
      expect((await withdraw(alice, 2_500)).status).toBe(201);
      expect(await balanceOf(alice)).toBe(0);
    });

    it('refuses to overdraw and leaves the balance untouched', async () => {
      await fund(ctx.app, alice, 1_000);
      const res = await withdraw(alice, 1_001);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
      expect(await balanceOf(alice)).toBe(1_000);
      const history = await api().get('/api/v1/account/transactions').set('Authorization', alice.bearer);
      expect(history.body.meta.total).toBe(1); // only the funding, no failed-withdrawal row
    });
  });

  describe('transferring', () => {
    it('moves money between accounts and writes both sides of the ledger', async () => {
      await fund(ctx.app, alice, 10_000);
      const res = await transfer(alice, bob, 4_000, { narration: 'Lunch' });

      expect(res.status).toBe(201);
      expect(res.body.balance).toBe(6_000);
      expect(res.body.transaction).toMatchObject({
        type: 'TRANSFER',
        direction: 'DEBIT',
        amount: 4_000,
        counterpartyAccountNumber: bob.accountNumber,
        narration: 'Lunch',
      });
      expect(await balanceOf(alice)).toBe(6_000);
      expect(await balanceOf(bob)).toBe(4_000);

      const bobHistory = await api().get('/api/v1/account/transactions').set('Authorization', bob.bearer);
      expect(bobHistory.body.data[0]).toMatchObject({
        type: 'TRANSFER',
        direction: 'CREDIT',
        amount: 4_000,
        balanceAfter: 4_000,
        counterpartyAccountNumber: alice.accountNumber,
        reference: res.body.transaction.reference,
      });
    });

    it('rejects a transfer larger than the balance and changes nothing', async () => {
      await fund(ctx.app, alice, 1_000);
      const res = await transfer(alice, bob, 1_500);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
      expect(await balanceOf(alice)).toBe(1_000);
      expect(await balanceOf(bob)).toBe(0);
    });

    it('rejects an unknown recipient', async () => {
      await fund(ctx.app, alice, 1_000);
      const res = await api()
        .post('/api/v1/account/transfer')
        .set('Authorization', alice.bearer)
        .send({ toAccountNumber: '0000000000', amount: 100 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RECIPIENT_NOT_FOUND');
    });

    it('rejects transfers to yourself', async () => {
      await fund(ctx.app, alice, 1_000);
      const res = await transfer(alice, alice, 100);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_TRANSFER');
    });

    it('validates the account number format and amount', async () => {
      const badNumber = await api()
        .post('/api/v1/account/transfer')
        .set('Authorization', alice.bearer)
        .send({ toAccountNumber: '123', amount: 100 });
      expect(badNumber.status).toBe(400);

      const badAmount = await transfer(alice, bob, -5);
      expect(badAmount.status).toBe(400);
    });

    it('does not repeat a transfer when an Idempotency-Key is reused', async () => {
      await fund(ctx.app, alice, 10_000);
      const send = () =>
        api()
          .post('/api/v1/account/transfer')
          .set('Authorization', alice.bearer)
          .set('Idempotency-Key', 'tr-1')
          .send({ toAccountNumber: bob.accountNumber, amount: 2_000 });

      expect((await send()).status).toBe(201);
      expect((await send()).status).toBe(200);
      expect(await balanceOf(alice)).toBe(8_000);
      expect(await balanceOf(bob)).toBe(2_000);
    });
  });

  describe('transaction history', () => {
    it('lists newest first, paginates, and only shows the caller’s own entries', async () => {
      await fund(ctx.app, alice, 10_000);
      await withdraw(alice, 1_000);
      await transfer(alice, bob, 2_000);
      await fund(ctx.app, bob, 777);

      const page1 = await api().get('/api/v1/account/transactions?limit=2').set('Authorization', alice.bearer);
      expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 3 });
      expect(page1.body.data.map((t: { type: string }) => t.type)).toEqual(['TRANSFER', 'WITHDRAWAL']);

      const page2 = await api().get('/api/v1/account/transactions?limit=2&page=2').set('Authorization', alice.bearer);
      expect(page2.body.data.map((t: { type: string }) => t.type)).toEqual(['FUND']);
    });

    it('validates paging parameters', async () => {
      const res = await api().get('/api/v1/account/transactions?limit=1000').set('Authorization', alice.bearer);
      expect(res.status).toBe(400);
    });
  });

  describe('concurrency & integrity', () => {
    it('never lets concurrent withdrawals overdraw the account', async () => {
      await fund(ctx.app, alice, 100);

      const results = await Promise.all(Array.from({ length: 10 }, () => withdraw(alice, 30)));

      expect(results.filter((r) => r.status === 201)).toHaveLength(3);
      expect(results.filter((r) => r.status === 422)).toHaveLength(7);
      expect(await balanceOf(alice)).toBe(10);
    });

    it('applies concurrent identical idempotent requests exactly once', async () => {
      const send = () =>
        api()
          .post('/api/v1/account/fund')
          .set('Authorization', alice.bearer)
          .set('Idempotency-Key', 'dup')
          .send({ amount: 100 });

      const results = await Promise.all(Array.from({ length: 5 }, send));

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 200)).toHaveLength(4);
      expect(await balanceOf(alice)).toBe(100);
    });

    it('conserves money across many simultaneous opposing transfers (no deadlock, no drift)', async () => {
      await fund(ctx.app, alice, 5_000);
      await fund(ctx.app, bob, 5_000);

      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? transfer(alice, bob, 100) : transfer(bob, alice, 50))),
      );

      expect(results.every((r) => r.status === 201)).toBe(true);
      const [a, b] = [await balanceOf(alice), await balanceOf(bob)];
      expect(a + b).toBe(10_000);
      expect(a).toBe(5_000 - 10 * 100 + 10 * 50);
    });

    it('keeps the ledger consistent with balances', async () => {
      await fund(ctx.app, alice, 9_000);
      await transfer(alice, bob, 2_500);
      await withdraw(bob, 1_000);

      for (const user of [alice, bob]) {
        const entries = await ctx.db('transactions')
          .join('accounts', 'accounts.id', 'transactions.account_id')
          .where('accounts.user_id', user.userId)
          .select('transactions.direction', 'transactions.amount');
        const net = entries.reduce(
          (sum: number, e: { direction: string; amount: unknown }) =>
            sum + (e.direction === 'CREDIT' ? Number(e.amount) : -Number(e.amount)),
          0,
        );
        expect(net).toBe(await balanceOf(user));
      }
    });

    it('enforces non-negative balances at the database level as a backstop', async () => {
      await expect(ctx.db('accounts').where({ user_id: alice.userId }).update({ balance: -1 })).rejects.toThrow();
    });
  });
});
