import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/** Brings the test database up to date before any test file runs. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smartparking_test';
  if (!/test/i.test(new URL(url).pathname)) throw new Error('Refusing to run tests: the test database name must contain "test".');
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(__dirname, '../drizzle') });
  } catch (err) {
    throw new Error(
      `Could not prepare the test database at ${url}.\nCreate it with:  createdb smartparking_test\n(or set TEST_DATABASE_URL). Cause: ${(err as Error).message}`,
    );
  } finally {
    await pool.end();
  }
}
