export function appOrigin() {
  const value = process.env.APP_ORIGIN || 'http://localhost:3000';
  const url = new URL(value);
  if (url.origin !== value || !['http:', 'https:'].includes(url.protocol))
    throw new Error(
      'APP_ORIGIN must be an absolute origin without a trailing slash',
    );
  return value;
}
export function mailConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.MAIL_FROM
  );
}
export function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'DATABASE_URL',
    'DATABASE_SSL',
    'BETTER_AUTH_SECRET',
    'APP_ORIGIN',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'MAIL_FROM',
    'S3_BUCKET',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length)
    throw new Error('Missing production settings: ' + missing.join(', '));
  if (!appOrigin().startsWith('https://'))
    throw new Error('Production APP_ORIGIN requires HTTPS');
  if (process.env.BETTER_AUTH_SECRET!.length < 32)
    throw new Error('Auth secret must contain at least 32 random characters');
  if (!['verify-full', 'private'].includes(process.env.DATABASE_SSL!))
    throw new Error('Explicit database TLS policy required');
  if (process.env.DATABASE_SSL === 'private') {
    const host = new URL(process.env.DATABASE_URL!).hostname;
    if (!(process.env.RENDER === 'true' && /^dpg-[a-z0-9-]+$/.test(host)))
      throw new Error(
        'Private non-TLS mode is restricted to the Render internal database hostname',
      );
  }
  if (process.env.SMTP_ALLOW_INSECURE === 'true')
    throw new Error('Production SMTP must verify TLS');
  if (
    process.env.S3_ENDPOINT &&
    !process.env.S3_ENDPOINT.startsWith('https://')
  )
    throw new Error('Production object storage requires HTTPS');
}
