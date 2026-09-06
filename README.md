# The Isle Garage

A private, manually maintained dinosaur garage for **The Isle: Evrima**, with selective public profiles for sharing with friends.

[Repository](https://github.com/MasoodMS95/The-Isle-Garage) · [Hosted site](https://isle-garage-design.masoodms.chatgpt.site)

> The repository includes the account, growth-stage, Prime, and public-profile updates. The hosted site may be behind this source; pushing to GitHub does not deploy it.

## Features

- **Game accounts:** named account tabs on desktop and a dropdown on mobile, with add and rename controls.
- **One server list:** favorites are shared across game accounts; each account has independent dinosaur records on each server.
- **Dinosaur tracking:** species, living/parked, dead, unknown, or no-dinosaur status, with optional skin codes and screenshots.
- **Growth:** choose a percentage from 1–100 or a stage: Juvie, Adolescent, Adult, or Full grown. Unknown/unset is supported; modes do not convert automatically.
- **Prime:** an independent checkbox, shown with a gold accent and a visible PRIME label.
- **Public profiles:** stable, read-only links showing explicitly selected account records, with server, growth, and status. Open profiles refresh saved data every 15 seconds.
- **Discord previews:** server-rendered Open Graph metadata and a PNG preview. Optional synchronization can edit one configured, existing bot-owned message.
- **Terminal-inspired design:** green monochrome styling, original illustrative scenery, pausable effects, and opt-in sound.

This is an unofficial fan project. Records are entered by users; there is no live game connection or Steam authentication.

## Privacy and account model

ChatGPT sign-in protects the editor and owner APIs. Game-account names are private labels, separate from the website sign-in identity.

Creating a link requires selecting individual account/server records. Each selection binds to a persistent account ID, so switching tabs or renaming an account does not redirect an existing share to another account.

Account labels, skin codes, and screenshots are excluded from public links unless explicitly enabled. Account email and sign-in name are never included in public record projections. Revoking a link blocks future access to its page, data, preview image, and shared screenshots. External services such as Discord can retain previously cached previews.

Screenshots are stored in private R2 storage and served through access-checked routes. Garage writes use optimistic versions to reject stale saves.

## Stack

React 19, TypeScript, Vinext/Vite, Tailwind CSS, shadcn/Base UI, and Cloudflare Workers. D1 stores garage and share records; R2 stores uploaded screenshots. Drizzle defines the database schema and migrations. Sites supplies the hosted access layer and runtime bindings.

## Local setup

Use Node.js **22.13 or newer** and npm. The integration workflow has been verified with Node.js 24.18. Commands below use a POSIX shell; Windows users can run them in WSL.

~~~sh
git clone https://github.com/MasoodMS95/The-Isle-Garage.git
cd The-Isle-Garage
npm ci
cp .env.example .env
npm run dev
~~~

The editor requires the Sites sign-in/identity layer. A local Worker without that layer redirects anonymous editor requests and rejects owner API requests. The integration tests simulate trusted dispatch headers locally; they do not establish real ChatGPT sessions.

### Test the production Worker locally

Build and prepare a separate local test database:

~~~sh
npm run build
mkdir -p outputs
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to outputs/test-state --file drizzle/0000_absent_lily_hollister.sql
node tests/accounts.integration.mjs --seed
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to outputs/test-state --file outputs/accounts-legacy.sql
npx wrangler dev --config dist/server/wrangler.json --persist-to outputs/test-state --port 8788
~~~

In another terminal:

~~~sh
node tests/accounts.integration.mjs
TEST_ORIGIN=http://localhost:8788 node tests/sharing.integration.mjs
~~~

The account suite requires its legacy fixture to be seeded before each run. Apply the schema once per fresh test-state directory. Use the same explicit persistence directory for all database and Worker commands; keeping it outside the generated build directory preserves test data across rebuilds.

Tests cover legacy migration, account isolation on the same server, shared favorites, stable renamed accounts, growth validation, Prime projection, optional labels, screenshot access, ownership, stale writes, same-link updates, preview images, and revocation. They use synthetic local records and do not send Discord messages.

### Source checks

~~~sh
npx tsc --noEmit
npx oxlint app lib db middleware.ts
npm run build
~~~

The scoped lint command checks application code. The full scaffold-wide lint command also includes vendored UI components.

## Data compatibility

Existing garages are read as the default **Main** game account. Existing 100% values remain 100%; legacy zero growth becomes unknown/unset rather than being changed to 1%.

The server can read both legacy record arrays and the newer account/server JSON structure. Existing share-selection arrays remain Main-only; newer selections can identify other accounts explicitly. No account deletion flow is provided.

After saving the new account format, a rollback must retain a compatible data reader. Older application versions cannot read the newer JSON envelope.

## Deployment

GitHub is the canonical source repository. The existing hosted site is configured by [.openai/hosting.json](.openai/hosting.json), with logical D1 binding **DB** and R2 binding **FILES**.

There is no GitHub Actions deployment workflow in this repository. The current Sites publishing workflow requires source provenance from its own configured source repository. GitHub pushes alone cannot satisfy that requirement. Do not silently mirror source back to Sites when GitHub has been chosen as the replacement; resolve the publishing destination separately.

Production must provide the trusted Sites sign-in dispatcher. The application treats its authenticated-user headers as trusted input, so a standalone Worker deployment needs an equivalent authentication boundary before accepting those headers.

## Optional Discord message synchronization

Synchronization is disabled by default and is not required for public links or initial link previews.

Configure these production runtime variables only after authorizing the exact destination:

| Variable | Purpose |
| --- | --- |
| SITE_ORIGIN | Canonical public origin for profile and preview URLs |
| DISCORD_SYNC_ENABLED | Set to true to enable synchronization |
| DISCORD_BOT_TOKEN | Bot token; store as a secret |
| DISCORD_CHANNEL_ID | Authorized destination channel |
| DISCORD_MESSAGE_ID | Existing message authored by that bot |
| DISCORD_SHARE_ID | The selected public share |
| DISCORD_OWNER_ID | The garage owner's Site-specific authenticated user ID |

The backend verifies the bot identity and message author before editing. It never creates a message. Saves and share changes attempt an update; the sharing dialog also offers an explicit retry when configured. Rate limits are respected, but there is no autonomous retry queue or delivery guarantee.

Deploy after changing production runtime variables. Keep tokens and local environment files out of source control. See [.env.example](.env.example) for the non-secret configuration template.

## Branch workflow

Use **main** as the canonical branch. Name development branches after their milestone or goal, for example **milestone/account-sharing** or **goal/mobile-layout**.

## Project structure

| Path | Purpose |
| --- | --- |
| app/garage-client.tsx | Private editor, game accounts, and server list |
| app/share-manager.tsx | Explicit public-link selection and management |
| app/s/[id]/ | Read-only public profiles and image/photo routes |
| app/api/ | Owner APIs and public selected-record API |
| lib/garage-model.ts | Account projection, selection IDs, and growth formatting |
| lib/server/ | Validation, persistence, authorization, and previews |
| db/ and drizzle/ | Database schema and migrations |
| tests/ | Local integration checks |
| public/ | Original artwork and static assets |

Generated builds, local databases, environment files, and temporary outputs are excluded from Git.
