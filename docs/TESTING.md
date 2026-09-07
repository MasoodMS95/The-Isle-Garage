# Local integration test

Use Node 24, Docker, and free ports 55438, 3090, and 2529. Never point this test at production.

```sh
docker run -d --name isle-garage-postgres-test -e POSTGRES_PASSWORD=local-integration-only -e POSTGRES_DB=garage_test -p 127.0.0.1:55438:5432 postgres:17-alpine
```

Create ignored .env.test.local with these **local test values** and a random BETTER_AUTH_SECRET of at least 32 characters:

```dotenv
APP_ORIGIN=http://localhost:3090
DATABASE_URL=postgres://postgres:local-integration-only@localhost:55438/garage_test
DATABASE_SSL=private
SMTP_HOST=127.0.0.1
SMTP_PORT=2529
MAIL_FROM=garage@example.test
SMTP_ALLOW_INSECURE=true
DISCORD_SYNC_ENABLED=false
NEXT_TELEMETRY_DISABLED=1
```

```sh
npm ci
node --env-file=.env.test.local --import tsx scripts/migrate.ts
node --env-file=.env.test.local --import tsx tests/security.integration.ts
```

The test starts Next.js and a loopback SMTP sink, creates unique synthetic accounts, and receives mail only in memory. No real emails or Discord messages are sent.

It covers verified sessions, Argon2id settings, one-use verification/reset, logout/reset revocation, private ownership, spoofed identity headers, CSRF/CORS, durable throttling, streamed body limits, private public-field projections, account/growth/Prime migration, static species/OG images, and revocation. It also checks mail retry recovery and production configuration.

Synthetic records persist only in the local containers. Final production HTTPS/SMTP-provider acceptance is separate; local tests cannot prove hosted provider settings.

Current security integration covers all 22 bundled assets, fallback mapping, retired image endpoint denial, ignored legacy photo sharing flags, upload rejection and production startup without storage credentials. Historical Worker tests are archived under legacy/sites/tests and are not current acceptance tests.

The static-art release was also validated against isolated native PostgreSQL 17 when Docker Desktop was unavailable; the same real auth/SMTP/garage tests ran, without an object-storage service. Run `node --import tsx tests/catalog.test.ts` for observed official server coverage and preservation, and the migration integration for legacy screenshot stripping.
