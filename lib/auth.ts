import { createHash } from 'node:crypto';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { hash, verify } from '@node-rs/argon2';
import { databasePool } from './server/database.ts';
import { appOrigin } from './server/config.ts';
import { ensureProfile } from './server/profile.ts';
import { queueEmail } from './server/mail.ts';
let instance: ReturnType<typeof betterAuth> | undefined;
export function authOptions(): BetterAuthOptions {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      'BETTER_AUTH_SECRET requires at least 32 random characters',
    );
  return {
    appName: 'The Isle Garage',
    baseURL: appOrigin(),
    secret,
    database: databasePool(),
    trustedOrigins: [appOrigin()],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureProfile(user.id);
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 900,
      password: {
        hash: (password: string) =>
          hash(password, {
            // The maintained adapter defaults to Argon2id.
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
            outputLen: 32,
          }),
        verify: ({
          hash: encoded,
          password,
        }: {
          hash: string;
          password: string;
        }) => verify(encoded, password),
      },
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) =>
        queueEmail(
          user.email,
          'Reset your Isle Garage password',
          'Use this link within 15 minutes: ' + url,
        ),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 900,
      sendVerificationEmail: async ({ user, url, token }) => {
        await databasePool().query(
          "INSERT INTO auth_verification_uses(hash,expires_at) VALUES($1,NOW()+INTERVAL '15 minutes') ON CONFLICT(hash) DO NOTHING",
          [createHash('sha256').update(token).digest('hex')],
        );
        await queueEmail(
          user.email,
          'Verify your Isle Garage email',
          'Use this link within 15 minutes: ' + url,
        );
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'database' as const,
      window: 60,
      max: 120,
      customRules: {
        '/get-session': false,
        '/sign-in/email': { window: 60, max: 30 },
        '/sign-up/email': { window: 60, max: 20 },
        '/request-password-reset': { window: 60, max: 20 },
      },
    },
    advanced: {
      useSecureCookies: appOrigin().startsWith('https://'),
      trustedProxyHeaders: false,
      ipAddress: { ipAddressHeaders: ['x-garage-rate-ip'] },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: appOrigin().startsWith('https://'),
      },
    },
    account: { accountLinking: { enabled: false } },
    logger: { disabled: true },
  };
}
export function getAuth() {
  return (instance ||= betterAuth(authOptions()));
}
