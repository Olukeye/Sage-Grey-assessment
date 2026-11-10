import type { Knex } from 'knex';

export const name = '001_initial_schema';

export async function up(db: Knex): Promise<void> {
  await db.schema.createTable('users', (t) => {
    t.uuid('id').primary();
    t.string('email', 254).notNullable().unique();
    t.string('full_name', 120).notNullable();
    t.string('password_hash', 100).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable();
  });

  await db.schema.createTable('accounts', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('RESTRICT');
    t.string('account_number', 10).notNullable().unique();
    t.string('currency', 3).notNullable();
    t.bigInteger('balance').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable();
    t.timestamp('updated_at', { useTz: true }).notNullable();
    t.check('?? >= 0', ['balance'], 'accounts_balance_non_negative');
  });

  await db.schema.createTable('transactions', (t) => {
    t.increments('seq'); 
    t.uuid('id').notNullable().unique();
    t.uuid('reference').notNullable();
    t.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('RESTRICT');
    t.uuid('counterparty_account_id').nullable().references('id').inTable('accounts');
    t.string('type', 16).notNullable();
    t.string('direction', 6).notNullable();
    t.bigInteger('amount').notNullable();
    t.bigInteger('balance_after').notNullable();
    t.string('narration', 140).nullable();
    t.string('idempotency_key', 100).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable();
    t.check('?? > 0', ['amount'], 'transactions_amount_positive');
    t.unique(['reference', 'account_id']);
    t.unique(['account_id', 'idempotency_key']);
    t.index(['account_id', 'seq']);
  });

  await db.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('family_id').notNullable().index();
    t.string('token_hash', 64).notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable();
  });
}

export async function down(db: Knex): Promise<void> {
  await db.schema.dropTableIfExists('refresh_tokens');
  await db.schema.dropTableIfExists('transactions');
  await db.schema.dropTableIfExists('accounts');
  await db.schema.dropTableIfExists('users');
}
