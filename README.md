# The Isle Garage

A private, manually maintained dinosaur garage for **The Isle: Evrima**, with selective public profiles.

## Features

- Named game accounts: desktop tabs, mobile dropdown, add and rename.
- One shared favorite-server list, with independent dinosaur records per account.
- Living/parked, dead, unknown, and empty states.
- Growth as **1–100%** or **Juvie / Adolescent / Adult / Full grown**, without automatic conversion.
- Independent **PRIME** status, with a text badge and gold accent.
- Stable read-only profiles; explicitly selected records refresh every 15 seconds.
- Optional skin codes and opt-in account labels; bundled species illustrations.
- Open Graph PNG previews and optional edits to one configured bot-owned Discord message.

This unofficial fan project does not connect to live game data or implement Steam authentication.

## Runtime and login

This milestone replaces Sites/Workers and ChatGPT sign-in with **Next.js 16 on Node.js**, **PostgreSQL**, **Better Auth email/password login**.

Email verification is mandatory. Passwords use a maintained Argon2id adapter with 19 MiB memory, two iterations, and one lane. Production requires email delivery, HTTPS and an explicit database TLS policy.

The migration is prepared for Render, with a portable Docker image. This branch does not provision paid services or remove the previous hosted app/data.

## Development

Use Node.js 24 and npm. Copy [.env.example](.env.example) to an ignored .env file and configure PostgreSQL, a random auth secret, and SMTP.

```sh
npm ci
node --env-file=.env --import tsx scripts/migrate.ts
npm run dev
```

Migrations create the auth library's tables and application tables. Registration/recovery are unavailable without email delivery. A local SMTP sink works for development; production rejects insecure SMTP.

```sh
npx tsc --noEmit
npx oxlint app lib scripts proxy.ts instrumentation.ts
npm run build
npm audit
```

See [testing](docs/TESTING.md) for the real PostgreSQL/SMTP integration test. Historical Worker configurations are retained for migration reference, not as the current runtime.

## Sharing privacy

Private routes authorize the signed-in owner. Public routes construct a selected-field response rather than returning the stored garage.

Links bind to persistent account/server IDs. Switching tabs or renaming labels cannot change their selected account. Emails, login identities, private favorite lists, and unselected records are not public fields.

Skin codes and account labels are excluded unless enabled. Revocation blocks future page/API/image access; third-party preview caches cannot be erased by this app.

## Deployment and operations

- [Render setup and costs](docs/DEPLOYMENT.md)
- [Security requirements and limits](docs/SECURITY.md)
- [Legacy export/import](docs/MIGRATION.md)
- [Environment template](.env.example)
- [Render Blueprint](render.yaml)
- [Dockerfile](Dockerfile)

GitHub is the only source destination. Use **main** as canonical and milestone/goal development names such as **milestone/hosting-auth**.

## Project structure

| Path                               | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| app/garage-client.tsx              | Editor, game accounts, server list          |
| app/login/ and app/reset-password/ | Email/password flows                        |
| app/api/auth/                      | Auth handler and request guards             |
| app/share-manager.tsx              | Explicit sharing                            |
| app/s/[id]/                        | Public profiles and protected images        |
| lib/auth.ts                        | Password/session/verification policy        |
| lib/server/                        | PostgreSQL, mail, ownership, projection |
| migrations/postgres/               | Application SQL                             |
| scripts/                           | Startup checks, migrations, legacy transfer |
| tests/security.integration.ts      | Real local integration tests                |
| legacy/                            | Previous platform reference                 |

Credentials, databases, builds, and temporary exports are excluded from Git. Never commit actual user emails, passwords, tokens, mail payloads, or backups.

## Dinosaur artwork

The garage, public profiles and Discord preview use bundled SVG illustrations for all 22 species in the selector. Other species retain their names and display an artwork-unavailable fallback. These original stylized silhouettes are not official game art or skin previews. See public/dinosaurs/README.md for coverage and provenance.

Screenshot uploads and their sharing setting are retired. Old private image endpoints always return 404, and saved image references are stripped from responses and subsequent saves. No S3/R2 account, bucket or credentials are needed. Existing remote objects/backups are untouched; any later cleanup requires a separately verified inventory.

The directory includes 27 unlocked official servers observed in user-provided in-game screenshots. Existing server IDs, favorites and records are preserved; no live population or availability is implied. See [server evidence](docs/SERVERS.md) and [species evidence](docs/SPECIES.md).

## New garages and interface styling

New accounts start with an empty garage and no favorite servers or sample dinosaurs. Discover still lists the official directory and existing illustrative community entries, all unfavorited and without dinosaur records. Existing saved records are preserved, including records resembling old demo values; there is no automatic database cleanup. Old browser records are only imported by an explicit user action and are never automatically seeded.

Tailwind 4 is compiled through postcss.config.mjs using @tailwindcss/postcss. Keep this configuration in production builds: shared dialogs, selects and tabs depend on generated utilities for positioning, focus styling and spacing.
