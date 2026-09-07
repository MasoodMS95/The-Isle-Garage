# Local integration test

Use Node 24, Docker, and free ports 55438, 59000, 3090, and 2529. Never point this test at production.

```sh
docker run -d --name isle-garage-postgres-test -e POSTGRES_PASSWORD=local-integration-only -e POSTGRES_DB=garage_test -p 127.0.0.1:55438:5432 postgres:17-alpine
docker run -d --name isle-garage-s3-test -e MINIO_ROOT_USER=localtest -e MINIO_ROOT_PASSWORD=local-test-storage-only -p 127.0.0.1:59000:9000 minio/minio:latest server /data
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
S3_ENDPOINT=http://localhost:59000
S3_REGION=us-east-1
S3_BUCKET=garage-test
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=localtest
S3_SECRET_ACCESS_KEY=local-test-storage-only
DISCORD_SYNC_ENABLED=false
NEXT_TELEMETRY_DISABLED=1
```

```sh
npm ci
node --env-file=.env.test.local --import tsx scripts/migrate.ts
node --env-file=.env.test.local --import tsx tests/security.integration.ts
```

The test starts Next.js and a loopback SMTP sink, creates unique synthetic accounts, and receives mail only in memory. No real emails or Discord messages are sent.

It covers verified sessions, Argon2id settings, one-use verification/reset, logout/reset revocation, private ownership/photos, spoofed identity headers, CSRF/CORS, durable throttling, streamed body limits, private public-field projections, account/growth/Prime migration, OG/S3 images, and revocation. It also checks mail retry recovery and production configuration.

Synthetic records persist only in the local containers. Final production HTTPS/SMTP-provider acceptance is separate; local tests cannot prove hosted provider settings.
