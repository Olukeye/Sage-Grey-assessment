import 'dotenv/config';
import { createApp } from './app';
import { loadConfig } from './config/env';
import { createDb } from './db/connection';
import { migrationSource } from './db/migrationSource';

async function main() {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  await db.migrate.latest({ migrationSource });

  const server = createApp(db, config).listen(config.PORT, () => {
    console.log(`Wallet API listening on http://localhost:${config.PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await db.destroy();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
