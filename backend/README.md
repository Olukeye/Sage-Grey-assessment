# Account API

TypeScript · Express 5 · Knex · PostgreSQL. Create an account, fund it, transfer to other users, withdraw. Includes full authentication (JWT access tokens + rotating refresh tokens).

Design rationale, data model and trade-offs: **[docs/DESIGN.md](docs/DESIGN.md)**.

> **Note on the stack.** The brief says "Knex + MongoDB", which cannot be combined (Knex is an SQL query builder). This project uses Knex with PostgreSQL. See the design doc, section 2.

## Requirements

- Node.js 20+
- Docker (for local PostgreSQL), or any PostgreSQL 14+ you already have

## Run it

```bash
npm install
cp .env.example .env          
docker compose up -d           
npm run dev                     
```

No Docker? Set `DATABASE_URL=sqlite::memory:` in `.env` to try the API with a throwaway in-memory database.

Production: `npm run build && npm start`. Run migrations on their own with `npm run migrate` (or `npm run migrate -- down` to roll back).

## Tests

```bash
npm test                  
npm run test:coverage

# against real PostgreSQL 
createdb wallet_test
TEST_DATABASE_URL=postgres://wallet:wallet@localhost:5432/wallet_test npm test
```

## Using the API

All amounts are **integers in kobo** (1 NGN = 100 kobo): `50000` is ₦500.00.

```bash
BASE=http://localhost:3000/api/v1

# Create an account 
curl -s -X POST $BASE/auth/register -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","fullName":"Ada Lovelace","password":"Analytical1"}'

TOKEN=...  

#  Fund account
curl -s -X POST $BASE/account/fund -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"amount":500000}'

#  Transfer (use the recipient's 10-digit accountNumber)
curl -s -X POST $BASE/account/transfer -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H 'Idempotency-Key: rent-nov-1' \
  -d '{"toAccountNumber":"1234567890","amount":120000,"narration":"Rent share"}'

#  Withdraw
curl -s -X POST $BASE/account/withdraw -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"amount":50000}'

# History
curl -s "$BASE/account/transactions?page=1&limit=20" -H "authorization: Bearer $TOKEN"
```

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | – | Create user + account |
| `POST /auth/login` | – | Sign in |
| `POST /auth/refresh` | – | `{refreshToken}` → new token pair (old one is invalidated) |
| `POST /auth/logout` | – | `{refreshToken}` → revoke session |
| `GET /auth/me` | ✔ | Current user and account |
| `GET /account` | ✔ | Balance |
| `POST /account/fund` | ✔ | `{amount}` |
| `POST /account/withdraw` | ✔ | `{amount}` |
| `POST /account/transfer` | ✔ | `{toAccountNumber, amount, narration?}` |
| `GET /account/transactions` | ✔ | Paginated history, newest first |
| `GET /health` | – | Health check |

Errors always look like `{"error":{"code":"INSUFFICIENT_FUNDS","message":"..."}}`. Send an `Idempotency-Key` header on money-moving calls so network retries never double-charge.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | required | `postgres://…` or `sqlite::memory:` |
| `JWT_SECRET` | required | ≥ 32 chars. `openssl rand -base64 48` |
| `PORT` | 3000 | |
| `ACCESS_TOKEN_TTL_SECONDS` | 900 | |
| `REFRESH_TOKEN_TTL_DAYS` | 7 | |
| `BCRYPT_ROUNDS` | 12 | |
| `AUTH_RATE_LIMIT_MAX` | 20 | per IP per 15 min on register/login/refresh |
| `CORS_ORIGIN` | http://localhost:5173 | |


## Database Decision
Decision for Database managment usage: Knex with MongoDB isn’t possible

The backend assessment asks for Knex and MongoDB, but Knex is an SQL query builder and has no MongoDB driver. I kept Knex and used PostgreSQL. I used Row locks and transactions to kee keep concurrent money movement correct as sql support acid which is a good choice for our account project.