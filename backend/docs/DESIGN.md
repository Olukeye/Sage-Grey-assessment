# Account API: Technical Design

## 1. Goal

A small, correct and secure account backend. A user can:

1. create an account,
2. fund it,
3. transfer funds to another user's account,
4. withdraw funds.

Authentication is real (not faux): registration, login, short-lived access tokens, rotating refresh tokens.

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Language / runtime | TypeScript on Node.js 20+, Express 5 | Type-safety on money-handling code; Express 5 forwards async errors to the error handler natively. |
| Query layer | **Knex** | Required by the brief. |
| Database | **PostgreSQL**  | See below. |
| Validation | Zod | One schema = runtime validation + inferred TypeScript types. |
| Passwords | bcrypt (cost 12) | Adaptive, salted, battle-tested. |
| Sessions | JWT access token (15 min) + opaque rotating refresh token (7 days) | Stateless API calls; revocable long-lived sessions. |
| Money | Integer minor units (kobo) | No floating point, ever. |

### Knex + MongoDB: why PostgreSQL instead

The brief lists "KnexJS ORM" and "MongoDB". These cannot be combined: Knex is an SQL query builder with no MongoDB driver. I kept **Knex** it is named first and is the layer the code is written against and chose **PostgreSQL**, because a wallet is the textbook case for relational ACID guarantees: multi-row atomic updates, row-level locks and `CHECK` constraints. MongoDB multi-document transactions need a replica set and offer weaker tooling for this. If MongoDB is a hard requirement, the right pairing is Mongoose/native driver instead of Knex. The service layer would be unchanged, only the repositories would be rewritten.

## 3. Architecture

```
HTTP  ->  routes (parse + validate, Zod)
              ->  services (business rules, transactions)
                       ->  repositories (Knex queries only)
                                ->  PostgreSQL
```

- **Routes** know HTTP; they never touch the DB.
- **Services** hold the rules (balance checks, idempotency, token rotation) and own the database transactions.
- **Repositories** are the only place SQL/Knex appears, and map rows to typed records (e.g. Postgres `BIGINT` strings → numbers).
- **Composition root** (`app.ts`) wires everything from `(db, config)`, so tests build the whole app against any database with no globals or mocks.

```
src/
  app.ts  server.ts
  config/env.ts            validated environment (fails fast)
  db/                      connection, migrations, migration runner
  shared/                  errors, error handler, money constants
  modules/auth/            register, login, refresh, logout, me
  modules/wallet/          account, fund, withdraw, transfer, history
```

## 4. Data model

```
users(id PK, email UNIQUE, full_name, password_hash, created_at)
accounts(id PK, user_id UNIQUE FK, account_number UNIQUE(10 digits), currency,
         balance BIGINT CHECK >= 0, created_at, updated_at)
transactions(seq PK autoinc, id UNIQUE, reference, account_id FK,
             counterparty_account_id FK null, type, direction, amount BIGINT CHECK > 0,
             balance_after, narration, idempotency_key, created_at,
             UNIQUE(reference, account_id), UNIQUE(account_id, idempotency_key))
refresh_tokens(id PK, user_id FK, family_id, token_hash UNIQUE, expires_at, revoked_at, created_at)
```

- **One account per user**, created in the same DB transaction as the user.
- **`transactions` is an append-only ledger**: one row per account movement. A transfer writes two rows (DEBIT + CREDIT) sharing a `reference`. `balance_after` makes every row independently auditable, and `seq` gives exact ordering regardless of clock resolution.
- `accounts.balance` is a denormalised running total, kept consistent with the ledger inside the same transaction (a test asserts ledger-sum == balance).
- Money is stored as `BIGINT` kobo. Amounts are capped (`MAX_TRANSACTION_AMOUNT`, `MAX_BALANCE`) so values always stay within JS's safe-integer range.

## 5. API (`/api/v1`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | – | Create user + account, returns tokens |
| `POST /auth/login` | – | Returns user, account, tokens |
| `POST /auth/refresh` | – | Rotate refresh token, returns new pair |
| `POST /auth/logout` | – | Revoke the session (idempotent, 204) |
| `GET /auth/me` | ✔ | Current user + account |
| `GET /account` | ✔ | Account and balance |
| `POST /account/fund` | ✔ | `{ amount }` credit |
| `POST /account/withdraw` | ✔ | `{ amount }` debit |
| `POST /account/transfer` | ✔ | `{ toAccountNumber, amount, narration? }` |
| `GET /account/transactions?page&limit` | ✔ | Newest-first ledger, paginated |
| `GET /health` | – | Liveness + DB check |

Errors use one shape: `{ "error": { "code", "message", "details?" } }` with stable machine-readable codes (`INSUFFICIENT_FUNDS`, `EMAIL_TAKEN`, ...). Unexpected errors return a generic 500 and never leak internals.

## 6. Correctness under concurrency

The core risk is a **lost update**: two requests read balance = 100, each withdraws 30, both write 70.

- Every balance change runs in a **DB transaction** that first does `SELECT ... FOR UPDATE` on the affected account row(s). Concurrent requests for one account queue up; the second sees the first's committed balance.
- **Transfers lock both accounts in ascending id order**, so A→B and B→A running simultaneously cannot deadlock.
- A `CHECK (balance >= 0)` constraint is a backstop: even a future code bug cannot persist a negative balance.
- Debit + credit + both ledger rows commit atomically or not at all.

This is verified, not assumed: the test-suite fires 10 concurrent withdrawals at a balance that covers exactly 3 and asserts exactly 3 succeed. I also confirmed the test **fails** if `FOR UPDATE` is removed (8 of 10 succeeded without it).

## 7. Idempotency

Clients may send an `Idempotency-Key` header on fund / withdraw / transfer. A retry with the same key (same account) returns the original result (HTTP 200 + `Idempotent-Replay: true`) and does not move money again. The check happens after the account lock is taken, so even *simultaneous* duplicates apply once. Enforced by `UNIQUE(account_id, idempotency_key)`.

## 8. Authentication & security

- **Passwords**: bcrypt; 8–72 chars with a letter and a digit (72 is bcrypt's input limit, so longer is rejected rather than silently truncated).
- **Access token**: HS256 JWT, 15 min, algorithm pinned on verify (blocks `alg: none` and algorithm confusion).
- **Refresh token**: 48 random bytes; only its SHA-256 is stored. **Rotation + reuse detection**: each refresh revokes the presented token and issues a new one in the same *family*. Presenting an already-used token implies theft, so the entire family is revoked.
- **Login** returns one identical error for unknown email and wrong password and spends equal bcrypt time in both cases (no user enumeration by message or timing).
- Auth endpoints are **rate-limited**; `helmet` security headers; CORS allow-list; 10 KB body limit; strict Zod validation on every input; secrets validated at boot (JWT secret ≥ 32 chars).
- A user can only ever act on their own account: the account is resolved from the token's subject, never from a client-supplied id.

## 9. Testing strategy

58 tests (≈94% statement coverage), run with `npm test`:

- **Integration (supertest)** across the real HTTP stack and a real database: every endpoint's happy path, validation, auth failures (expired / forged / unsigned tokens), refresh rotation and theft detection, rate limiting, idempotency, ledger/balance consistency, DB-constraint backstop.
- **Concurrency**: overdraw race, duplicate idempotent requests, opposing simultaneous transfers (money conserved, no deadlock).
- **Unit**: token service, environment validation.
- Runs on in-memory SQLite by default (no setup) **and** on PostgreSQL via `TEST_DATABASE_URL`. Both are green.

## 10. Assumptions and limits

- **Funding and withdrawal are simulated** as direct credit/debit. In production they would be driven by a payment provider (initiate → webhook confirms → post to ledger), with a "settlement" system account so the books are true double-entry.
- Single currency (NGN). Multi-currency needs FX and per-currency accounts.
- Access tokens can't be revoked before they expire (15 min); a denylist or shorter TTL would close that if required.
- Not included but natural next steps: email verification, password reset, MFA, per-user transaction limits/KYC tiers, structured logging and metrics, an outbox for notifications, OpenAPI docs.
