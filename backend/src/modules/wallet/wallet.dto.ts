export type TransactionType = 'FUND' | 'WITHDRAWAL' | 'TRANSFER';
export type Direction = 'CREDIT' | 'DEBIT';

export interface AccountDto {
  id: string;
  accountNumber: string;
  currency: string;
  balance: number;
  createdAt: string;
}

export interface TransactionDto {
  id: string;
  reference: string;
  type: TransactionType;
  direction: Direction;
  amount: number;
  balanceAfter: number;
  counterpartyAccountNumber: string | null;
  narration: string | null;
  createdAt: string;
}

export interface TransactionResult {
  transaction: TransactionDto;
  balance: number;
  replayed: boolean;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}
