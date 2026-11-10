import { z } from 'zod';
import { MAX_TRANSACTION_AMOUNT } from '../../shared/money';

const amount = z
  .number({ error: 'Amount must be a number of kobo (1 NGN = 100 kobo).' })
  .int('Amount must be a whole number of kobo (1 NGN = 100 kobo).')
  .positive('Amount must be greater than zero.')
  .max(MAX_TRANSACTION_AMOUNT, 'Amount exceeds the maximum allowed per transaction.');

export const amountSchema = z.object({ amount });

export const transferSchema = z.object({
  toAccountNumber: z.string().regex(/^\d{10}$/, 'Account numbers have exactly 10 digits.'),
  amount,
  narration: z.string().trim().max(140).optional(),
});

export const idempotencyKeySchema = z.string().trim().min(1).max(100).optional();

export const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
