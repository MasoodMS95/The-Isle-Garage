import { Pool } from 'pg';
let pool: Pool | undefined;
export function databasePool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (pool ||= new Pool({
    connectionString: (() => {
      const url = new URL(process.env.DATABASE_URL!);
      for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
        if (url.searchParams.has(key))
          throw new Error(
            'Use DATABASE_SSL and DATABASE_CA_CERT for explicit TLS settings',
          );
      }
      return url.toString();
    })(),
    ssl:
      process.env.DATABASE_SSL === 'verify-full'
        ? {
            rejectUnauthorized: true,
            ca: process.env.DATABASE_CA_CERT || undefined,
          }
        : false,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
export function database() {
  return {
    prepare(sql: string) {
      let index = 0;
      const query = sql.replace(/\?/g, () => '$' + ++index);
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              const result = await databasePool().query(query, values);
              return (result.rows[0] as T) || null;
            },
            async all<T>() {
              const result = await databasePool().query(query, values);
              return { results: result.rows as T[] };
            },
            async run() {
              await databasePool().query(query, values);
            },
          };
        },
      };
    },
  };
}
