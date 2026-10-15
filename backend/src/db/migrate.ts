import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';

/** Applies every SQL migration in backend/drizzle that has not been applied yet. */
async function main() {
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../../drizzle')
  });

  console.log('Database migrations applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed!');
  console.error(err);
  console.error(
    'Error details:',
    JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
  );
  process.exit(1);
});