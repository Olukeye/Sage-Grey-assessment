import { Router, type RequestHandler } from 'express';
import type { WalletService } from './wallet.service';
import {
  amountSchema,
  idempotencyKeySchema,
  listTransactionsSchema,
  transferSchema,
} from './wallet.schemas';
import type { TransactionResult } from './wallet.dto';

export function createWalletRouter(service: WalletService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  const key = (header: string | undefined) => idempotencyKeySchema.parse(header);
  const respond = (res: import('express').Response, result: TransactionResult) => {
    const { replayed, ...body } = result;
    if (replayed) res.setHeader('Idempotent-Replay', 'true');
    res.status(replayed ? 200 : 201).json(body);
  };

  router.get('/', async (req, res) => {
    res.json({ account: await service.getAccount(req.userId!) });
  });

  router.post('/fund', async (req, res) => {
    const { amount } = amountSchema.parse(req.body);
    respond(res, await service.fund(req.userId!, amount, key(req.header('idempotency-key'))));
  });

  router.post('/withdraw', async (req, res) => {
    const { amount } = amountSchema.parse(req.body);
    respond(res, await service.withdraw(req.userId!, amount, key(req.header('idempotency-key'))));
  });

  router.post('/transfer', async (req, res) => {
    const input = transferSchema.parse(req.body);
    respond(res, await service.transfer(req.userId!, input, key(req.header('idempotency-key'))));
  });

  router.get('/transactions', async (req, res) => {
    const { page, limit } = listTransactionsSchema.parse(req.query);
    res.json(await service.listTransactions(req.userId!, page, limit));
  });

  return router;
}
