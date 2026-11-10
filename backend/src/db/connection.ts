import knex, { type Knex } from 'knex';

export type Db = Knex | Knex.Transaction;

export function createDb(url: string): Knex {
  if (url.startsWith('sqlite:')) {
    return knex({
      client: 'better-sqlite3',
      connection: { filename: url.slice('sqlite:'.length) },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
        afterCreate: (conn: { pragma: (sql: string) => void }, done: (err: Error | null, conn: unknown) => void) => {
          conn.pragma('foreign_keys = ON');
          done(null, conn);
        },
      },
    });
  }
  return knex({ client: 'pg', connection: url, pool: { min: 0, max: 10 } });
}
