import type { Knex } from 'knex';
import * as initialSchema from './migrations/001_initial_schema';


const migrations = [initialSchema];

export const migrationSource: Knex.MigrationSource<(typeof migrations)[number]> = {
  getMigrations: async () => migrations,
  getMigrationName: (migration) => migration.name,
  getMigration: async (migration) => migration,
};
