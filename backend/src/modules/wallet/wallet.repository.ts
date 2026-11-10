import type { Db } from '../../db/connection';
import type { Direction, TransactionType } from './wallet.dto';

export interface AccountRecord {
  id: string;
  userId: string;
  accountNumber: string;
  currency: string;
  balance: number;
  createdAt: Date;
}

export interface LedgerEntry {
  id: string;
  reference: string;
  accountId: string;
  counterpartyAccountId: string | null;
  type: TransactionType;
  direction: Direction;
  amount: number;
  balanceAfter: number;
  narration: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface LedgerEntryWithCounterparty extends LedgerEntry {
  counterpartyAccountNumber: string | null;
}

const toDate = (value: unknown) => new Date(value as string | number | Date);

// Postgres returns BIGINT as a string; amounts are bounded well below 2^53 so Number() is lossless.
const toAccount = (row: Record<string, unknown>): AccountRecord => ({
  id: row.id as string,
  userId: row.user_id as string,
  accountNumber: row.account_number as string,
  currency: row.currency as string,
  balance: Number(row.balance),
  createdAt: toDate(row.created_at),
});

const toEntry = (row: Record<string, unknown>): LedgerEntry => ({
  id: row.id as string,
  reference: row.reference as string,
  accountId: row.account_id as string,
  counterpartyAccountId: (row.counterparty_account_id as string | null) ?? null,
  type: row.type as TransactionType,
  direction: row.direction as Direction,
  amount: Number(row.amount),
  balanceAfter: Number(row.balance_after),
  narration: (row.narration as string | null) ?? null,
  idempotencyKey: (row.idempotency_key as string | null) ?? null,
  createdAt: toDate(row.created_at),
});

export class WalletRepository {
  async insertAccount(db: Db, account: AccountRecord): Promise<void> {
    await db('accounts').insert({
      id: account.id,
      user_id: account.userId,
      account_number: account.accountNumber,
      currency: account.currency,
      balance: account.balance,
      created_at: account.createdAt,
      updated_at: account.createdAt,
    });
  }

  async accountNumberExists(db: Db, accountNumber: string): Promise<boolean> {
    return Boolean(await db('accounts').where({ account_number: accountNumber }).first('id'));
  }

  async findByUserId(db: Db, userId: string): Promise<AccountRecord | undefined> {
    const row = await db('accounts').where({ user_id: userId }).first();
    return row && toAccount(row);
  }

  async findByAccountNumber(db: Db, accountNumber: string): Promise<AccountRecord | undefined> {
    const row = await db('accounts').where({ account_number: accountNumber }).first();
    return row && toAccount(row);
  }

  /**
   * SELECT ... FOR UPDATE. Rows are always locked in ascending id order so two transfers
   * between the same pair of accounts (A->B and B->A) can never deadlock.
   * (SQLite, used in tests, serialises writers, and Knex omits FOR UPDATE for it.)
   */
  async lockByIds(db: Db, ids: string[]): Promise<AccountRecord[]> {
    const rows = await db('accounts').whereIn('id', ids).orderBy('id', 'asc').forUpdate();
    return rows.map(toAccount);
  }

  async updateBalance(db: Db, id: string, balance: number, at: Date): Promise<void> {
    await db('accounts').where({ id }).update({ balance, updated_at: at });
  }

  async insertEntry(db: Db, entry: LedgerEntry): Promise<void> {
    await db('transactions').insert({
      id: entry.id,
      reference: entry.reference,
      account_id: entry.accountId,
      counterparty_account_id: entry.counterpartyAccountId,
      type: entry.type,
      direction: entry.direction,
      amount: entry.amount,
      balance_after: entry.balanceAfter,
      narration: entry.narration,
      idempotency_key: entry.idempotencyKey,
      created_at: entry.createdAt,
    });
  }

  async findEntryByIdempotencyKey(
    db: Db,
    accountId: string,
    key: string,
  ): Promise<LedgerEntryWithCounterparty | undefined> {
    const row = await this.entriesQuery(db).where('t.account_id', accountId).where('t.idempotency_key', key).first();
    return row && { ...toEntry(row), counterpartyAccountNumber: (row.counterparty_number as string | null) ?? null };
  }

  async listEntries(
    db: Db,
    accountId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: LedgerEntryWithCounterparty[]; total: number }> {
    const [{ total }] = await db('transactions').where({ account_id: accountId }).count({ total: '*' });
    const rows = await this.entriesQuery(db)
      .where('t.account_id', accountId)
      .orderBy('t.seq', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    return {
      total: Number(total),
      rows: rows.map((row: Record<string, unknown>) => ({
        ...toEntry(row),
        counterpartyAccountNumber: (row.counterparty_number as string | null) ?? null,
      })),
    };
  }

  private entriesQuery(db: Db) {
    return db('transactions as t')
      .leftJoin('accounts as c', 'c.id', 't.counterparty_account_id')
      .select('t.*', 'c.account_number as counterparty_number');
  }
}
