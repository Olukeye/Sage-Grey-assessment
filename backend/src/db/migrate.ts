import 'dotenv/config';
import { loadConfig } from '../config/env';
import { createDb } from './connection';
import { migrationSource } from './migrationSource';

async function main() {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  try {
    const direction = process.argv[2] === 'down' ? 'down' : 'latest';
    const [, applied] = direction === 'down' ? await db.migrate.down({ migrationSource }) : await db.migrate.latest({ migrationSource });
    console.log(`Migration ${direction}: ${applied.length ? [applied].flat().join(', ') : 'nothing to do'}`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
