import type { PoolClient } from 'pg';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import nodemailer from 'nodemailer';
import { databasePool } from './database.ts';
import { mailConfigured } from './config.ts';
function key() {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error('Auth secret required');
  return createHash('sha256')
    .update(process.env.BETTER_AUTH_SECRET)
    .update('mail-outbox-v1')
    .digest();
}
export async function queueEmail(to: string, subject: string, text: string) {
  if (!mailConfigured()) throw new Error('Email delivery is unavailable');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify({ to, subject, text }), 'utf8'),
    cipher.final(),
  ]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    'base64',
  );
  await databasePool().query(
    "INSERT INTO mail_outbox(id,payload,expires_at) VALUES ($1,$2,NOW()+INTERVAL '15 minutes')",
    [crypto.randomUUID(), payload],
  );
  startMailWorker();
}
let timer: ReturnType<typeof setInterval> | undefined,
  busy = false;
export function startMailWorker() {
  if (timer || !mailConfigured()) return;
  timer = setInterval(
    () =>
      void flushMail().catch(() => {
        /* No email addresses, bodies, URLs or credentials in logs. */
      }),
    2000,
  );
  timer.unref();
}
export async function flushMail(
  acquire: () => Promise<PoolClient> = () => databasePool().connect(),
) {
  if (busy || !mailConfigured()) return;
  busy = true;
  let connection: PoolClient | undefined;
  try {
    connection = await acquire();
    await connection.query('BEGIN');
    await connection.query('DELETE FROM mail_outbox WHERE expires_at < NOW()');
    const result = await connection.query(
      'SELECT * FROM mail_outbox WHERE next_attempt <= NOW() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED',
    );
    const row = result.rows[0];
    if (row) {
      try {
        const payload = Buffer.from(row.payload, 'base64'),
          decipher = createDecipheriv(
            'aes-256-gcm',
            key(),
            payload.subarray(0, 12),
          );
        decipher.setAuthTag(payload.subarray(12, 28));
        const message = JSON.parse(
          Buffer.concat([
            decipher.update(payload.subarray(28)),
            decipher.final(),
          ]).toString('utf8'),
        );
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: process.env.SMTP_PORT === '465',
          requireTLS: process.env.SMTP_ALLOW_INSECURE !== 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
          connectionTimeout: 5000,
          socketTimeout: 10000,
          logger: false,
          debug: false,
        });
        await transport.sendMail({ from: process.env.MAIL_FROM, ...message });
        await connection.query('DELETE FROM mail_outbox WHERE id=$1', [row.id]);
      } catch {
        await connection.query(
          "UPDATE mail_outbox SET attempts=attempts+1,next_attempt=NOW()+INTERVAL '30 seconds' WHERE id=$1",
          [row.id],
        );
      }
    }
    await connection.query('COMMIT');
  } catch {
    if (connection) await connection.query('ROLLBACK').catch(() => {});
  } finally {
    connection?.release();
    busy = false;
  }
}
