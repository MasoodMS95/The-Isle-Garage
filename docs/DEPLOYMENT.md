# Render deployment

This Blueprint is a configuration proposal, not permission to purchase resources.

## Services and costs

One Docker web service (0.5c-512mb) and one managed PostgreSQL instance (0.1c-256mb, PostgreSQL 17, 1 GB disk), both in Oregon. Automatic deployments are off. PostgreSQL's public IP allowlist is empty.

The [current Blueprint reference](https://render.com/docs/blueprint-spec) documents these plan IDs. The working estimate discussed is about **$13/month for app and database compute**, before disk, object storage, requests/egress, email, tax, and account-plan charges. Confirm the actual Render checkout total first. $15–20/month is a planning allowance, not a spending cap or quote. AWS can run the container but self-management adds maintenance.

## Setup after review

1. Merge the reviewed milestone into **main** first. The Blueprint targets main; deploying it before that merge would use the old app.
2. Connect the GitHub repository to the existing Render account and review render.yaml.
3. Confirm the full recurring price before applying.
4. Configure a private S3-compatible bucket, no public access, least-privilege credentials, encryption, versioning, and backup/lifecycle policy.
5. Configure authenticated SMTP with a verified sending domain (SPF/DKIM/DMARC). Fill requested environment settings.
6. Set APP_ORIGIN to the exact HTTPS origin without a trailing slash. Keep the generated auth secret secure; rotating it invalidates sessions and encrypted queued mail.
7. For AWS S3, omit S3_ENDPOINT from the Blueprint/env settings, or supply the correct regional HTTPS endpoint. Other providers need their actual HTTPS endpoint and path-style setting.
8. DATABASE_SSL=private is restricted to Render's internal short database hostname while RENDER=true. Public database endpoints require verify-full and, when needed, DATABASE_CA_CERT. Do not add URL SSL overrides or disable certificate verification.
9. Deploy. Container startup checks settings, applies locked/idempotent migrations, then runs Next.js as an unprivileged user.
10. Verify health, email verification, login/logout/reset, private ownership, a public profile, and revocation on the real HTTPS origin before launch.

Production fails startup if required mail/storage/security settings are absent. The Blueprint does not provision email or object storage.

## Operational limits

Client-supplied IP forwarding headers are ignored. Auth mutations use a conservative shared database-backed library bucket plus a per-email HMAC bucket. Session reads do not consume the shared bucket. Spoofing headers cannot bypass this, but an attacker can exhaust the shared allowance and delay other users. Before higher traffic, add trusted edge abuse controls and verify proxy header replacement. Do not simply trust raw X-Forwarded-For.

The encrypted durable mail outbox drains on startup and after enqueue, retries failures, and expires after 15 minutes. App downtime delays mail. Monitor provider delivery and queue age without logging recipients or bodies.

Configure platform/proxy/tracing logs to exclude auth query strings, bodies, cookies, and authorization headers. Verification/reset URLs contain secrets. Application log tests cannot prove external provider logging policy.

Configure database and matching object backups, and test restoration. Do not roll back to old Sites code after importing into this schema.

Discord synchronization remains disabled unless separately configured and authorized. It only edits an existing bot-owned message.
