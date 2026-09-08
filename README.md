# The Isle Garage

A private, manually maintained dinosaur garage for **The Isle: Evrima**, with selective public profiles.

## Features

- Named game accounts: desktop tabs, mobile dropdown, add and rename.
- One shared favorite-server list, with independent dinosaur records per account.
- Living/parked, dead, unknown, and empty states.
- Growth as **1–100%** or **Juvie / Adolescent / Adult / Full grown**, without automatic conversion.
- Independent **PRIME** status, with a text badge and gold accent.
- One automatically assigned stable garage link per website account, private by default; public records refresh every 15 seconds.
- Whole-garage public visibility includes all game-account labels and skin codes; bundled species illustrations.
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

Private routes authorize the signed-in owner. Each user gets a random opaque profile ID, unrelated to their email or internal account ID. There is no public directory or email lookup.

Sharing has one Public/Private switch. Private is the default and makes the public page, API and OG image return 404 even to the owner; owners preview records in their private garage. Public exposes all stored servers across all game accounts, including labels, status, species, growth, Prime and skin codes. New accounts and records appear automatically after saving. Auth names, email, passwords, sessions and upload references are never projected.

Choose a separate public username once in sharing settings for `/parked/your_username`. It accepts 3–30 ASCII letters/numbers with single internal hyphens or underscores, is case-insensitively unique, and cannot be renamed. Your private sign-in name and email are never used. Before choosing, an assigned garage link is available; it and the previous opaque `/s/` profile link remain privacy-gated aliases to the chosen address. The link stays stable across visibility changes. Old selected links are retired with a notice, never silently broadened; their retained database rows do not grant access. Changing back to private blocks future access but cannot recall Discord or other third-party cached previews.

Copy link shows a completion message after the browser clipboard request succeeds. If clipboard access fails, the full link is selected with manual-copy instructions; the link field can always be selected and copied directly.

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
| lib/server/                        | PostgreSQL, mail, ownership, projection     |
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

New accounts start with an empty garage and no favorite servers or sample dinosaurs. Discover still lists the official directory and existing illustrative unofficial entries, all unfavorited and without dinosaur records. Existing saved records are preserved, including records resembling old demo values; there is no automatic database cleanup. Old browser records are only imported by an explicit user action and are never automatically seeded.

Tailwind 4 is compiled through postcss.config.mjs using @tailwindcss/postcss. Keep this configuration in production builds: shared dialogs, selects and tabs depend on generated utilities for positioning, focus styling and spacing.

## Development workflow

Use main as the canonical branch and milestone/... or goal/... for development. Validate the work, then merge into main within the user's authorization. Do not create pull requests. An approval rejection must be resolved before merging; a direct merge is never a workaround for a rejected action.

The visible Unofficial category maps to the existing stored Community value, preserving IDs, favorites and records.
