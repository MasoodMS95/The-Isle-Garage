import { getMigrations } from 'better-auth/db/migration';
import { readFile } from 'node:fs/promises';
import { authOptions } from '../lib/auth.ts';
import { databasePool } from '../lib/server/database.ts';
const connection = await databasePool().connect();
try {
  await connection.query('SELECT pg_advisory_lock(741937)');
  const { runMigrations } = await getMigrations(authOptions());
  await runMigrations();
  await connection.query(
    await readFile(
      new URL('../migrations/postgres/001-garage.sql', import.meta.url),
      'utf8',
    ),
  );
  await connection.query(
    await readFile(
      new URL(
        '../migrations/postgres/002-garage-profiles.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  console.log('Database migrations complete.');
} finally {
  await connection.query('SELECT pg_advisory_unlock(741937)');
  connection.release();
  await databasePool().end();
}
