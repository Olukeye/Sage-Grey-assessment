import { randomInt, randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import type { Db } from '../../db/connection';
import { notFound, AppError, unprocessable } from '../../shared/errors';
import { CURRENCY, MAX_BALANCE } from '../../shared/money';
import type { AccountDto, Page, TransactionDto, TransactionResult } from './wallet.dto';
import type {
  AccountRecord,
  LedgerEntry,
  LedgerEntryWithCounterparty,
  WalletRepository,
} from './wallet.repository';

const toAccountDto = (account: AccountRecord): AccountDto => ({
  id: account.id,
  accountNumber: account.accountNumber,
  currency: account.currency,
  balance: account.balance,
  createdAt: account.createdAt.toISOString(),
});

const toTransactionDto = (entry: LedgerEntryWithCounterparty): TransactionDto => ({
  id: entry.id,
  reference: entry.reference,
  type: entry.type,
  direction: entry.direction,
  amount: entry.amount,
  balanceAfter: entry.balanceAfter,
  counterpartyAccountNumber: entry.counterpartyAccountNumber,
  narration: entry.narration,
  createdAt: entry.createdAt.toISOString(),
});

interface TransferInput {
  toAccountNumber: string;
  amount: number;
  narration?: string;
}

export class WalletService {
  constructor(
    private readonly db: Knex,
    private readonly repository: WalletRepository,
  ) {}

  //Called inside the registration transaction so every user always has exactly one account. */
  async openAccount(db: Db, userId: string): Promise<AccountDto> {
    const accountNumber = await this.generateAccountNumber(db);
    const now = new Date();
    const account: AccountRecord = {
      id: randomUUID(),
      userId,
      accountNumber,
      currency: CURRENCY,
      balance: 0,
      createdAt: now,
    };
    await this.repository.insertAccount(db, account);
    return toAccountDto(account);
  }

  async getAccountByUserId(db: Db, userId: string): Promise<AccountDto> {
    const account = await this.repository.findByUserId(db, userId);
    if (!account) throw notFound('ACCOUNT_NOT_FOUND', 'No account exists for this user.');
    return toAccountDto(account);
  }

  getAccount(userId: string): Promise<AccountDto> {
    return this.getAccountByUserId(this.db, userId);
  }

  fund(userId: string, amount: number, idempotencyKey?: string): Promise<TransactionResult> {
    return this.applySingleAccountMovement(userId, {
      type: 'FUND',
      direction: 'CREDIT',
      amount,
      idempotencyKey,
    });
  }

  withdraw(userId: string, amount: number, idempotencyKey?: string): Promise<TransactionResult> {
    return this.applySingleAccountMovement(userId, {
      type: 'WITHDRAWAL',
      direction: 'DEBIT',
      amount,
      idempotencyKey,
    });
  }

  async transfer(userId: string, input: TransferInput, idempotencyKey?: string): Promise<TransactionResult> {
    return this.db.transaction(async (trx) => {
      const own = await this.repository.findByUserId(trx, userId);
      if (!own) throw notFound('ACCOUNT_NOT_FOUND', 'No account exists for this user.');

      const recipient = await this.repository.findByAccountNumber(trx, input.toAccountNumber);
      if (!recipient) throw notFound('RECIPIENT_NOT_FOUND', 'No account exists with that account number.');
      if (recipient.id === own.id) {
        throw new AppError(400, 'SELF_TRANSFER', 'You cannot transfer money to your own account.');
      }

      // Lock both rows in a fixed order and work from the locked, up-to-date balances.
      const locked = await this.repository.lockByIds(trx, [own.id, recipient.id]);
      const sender = locked.find((a) => a.id === own.id)!;
      const receiver = locked.find((a) => a.id === recipient.id)!;

      const replay = await this.findReplay(trx, sender.id, idempotencyKey);
      if (replay) return replay;

      if (sender.balance < input.amount) throw this.insufficientFunds();
      if (receiver.balance + input.amount > MAX_BALANCE) throw this.balanceLimit();

      const now = new Date();
      const reference = randomUUID();
      const debit: LedgerEntry = {
        id: randomUUID(),
        reference,
        accountId: sender.id,
        counterpartyAccountId: receiver.id,
        type: 'TRANSFER',
        direction: 'DEBIT',
        amount: input.amount,
        balanceAfter: sender.balance - input.amount,
        narration: input.narration ?? null,
        idempotencyKey: idempotencyKey ?? null,
        createdAt: now,
      };
      const credit: LedgerEntry = {
        ...debit,
        id: randomUUID(),
        accountId: receiver.id,
        counterpartyAccountId: sender.id,
        direction: 'CREDIT',
        balanceAfter: receiver.balance + input.amount,
        idempotencyKey: null, // keys are scoped to the initiating (sending) account
      };

      await this.repository.updateBalance(trx, sender.id, debit.balanceAfter, now);
      await this.repository.updateBalance(trx, receiver.id, credit.balanceAfter, now);
      await this.repository.insertEntry(trx, debit);
      await this.repository.insertEntry(trx, credit);

      return {
        transaction: toTransactionDto({ ...debit, counterpartyAccountNumber: receiver.accountNumber }),
        balance: debit.balanceAfter,
        replayed: false,
      };
    });
  }

  async listTransactions(userId: string, page: number, limit: number): Promise<Page<TransactionDto>> {
    const account = await this.repository.findByUserId(this.db, userId);
    if (!account) throw notFound('ACCOUNT_NOT_FOUND', 'No account exists for this user.');
    const { rows, total } = await this.repository.listEntries(this.db, account.id, page, limit);
    return { data: rows.map(toTransactionDto), meta: { page, limit, total } };
  }

  private applySingleAccountMovement(
    userId: string,
    movement: { 
      type: 'FUND' | 'WITHDRAWAL'; 
      direction: 'CREDIT' | 'DEBIT'; 
      amount: number; 
      idempotencyKey?: string 
    },
  ): Promise<TransactionResult> {
    return this.db.transaction(async (trx) => {
      const own = await this.repository.findByUserId(trx, userId);
      if (!own) throw notFound('ACCOUNT_NOT_FOUND', 'No account exists for this user.');

      const [account] = await this.repository.lockByIds(trx, [own.id]);

      const replay = await this.findReplay(trx, account.id, movement.idempotencyKey);
      if (replay) return replay;

      const balanceAfter =
        movement.direction === 'CREDIT' ? account.balance + movement.amount : account.balance - movement.amount;
      if (balanceAfter < 0) throw this.insufficientFunds();
      if (balanceAfter > MAX_BALANCE) throw this.balanceLimit();

      const now = new Date();
      const entry: LedgerEntry = {
        id: randomUUID(),
        reference: randomUUID(),
        accountId: account.id,
        counterpartyAccountId: null,
        type: movement.type,
        direction: movement.direction,
        amount: movement.amount,
        balanceAfter,
        narration: null,
        idempotencyKey: movement.idempotencyKey ?? null,
        createdAt: now,
      };

      await this.repository.updateBalance(trx, account.id, balanceAfter, now);
      await this.repository.insertEntry(trx, entry);

      return {
        transaction: toTransactionDto({ ...entry, counterpartyAccountNumber: null }),
        balance: balanceAfter,
        replayed: false,
      };
    });
  }

  private async findReplay(db: Db, accountId: string, key?: string): Promise<TransactionResult | undefined> {
    if (!key) return undefined;
    const existing = await this.repository.findEntryByIdempotencyKey(db, accountId, key);
    if (!existing) return undefined;
    return { transaction: toTransactionDto(existing), balance: existing.balanceAfter, replayed: true };
  }

  private async generateAccountNumber(db: Db): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = String(randomInt(0, 10_000_000_000)).padStart(10, '0');
      if (!(await this.repository.accountNumberExists(db, candidate))) return candidate;
    }
    throw new Error('Could not allocate a unique account number');
  }

  private insufficientFunds() {
    return unprocessable('INSUFFICIENT_FUNDS', 'Your balance is too low for this transaction.');
  }

  private balanceLimit() {
    return unprocessable('BALANCE_LIMIT_EXCEEDED', 'This transaction would exceed the maximum balance.');
  }
}
