# Security requirements

## Implemented

- Better Auth handles verified email, credential flows, signed cookies, expiry/reset/logout. Passwords use maintained Argon2id with random salts (19 MiB, t=2, p=1).
- HttpOnly, SameSite=Lax cookies are Secure on production HTTPS. Sessions expire after seven days; reset and logout revoke sessions. Session cookie caching is disabled.
- Registration requires verification. Email-based account linking is disabled. Registration/recovery avoid confirming address existence. Verification/reset links expire after 15 minutes and are one-use.
- PostgreSQL backs library limits and HMAC per-email throttle keys. Forwarding headers are ignored; shared-bucket availability limitations are documented separately.
- Auth POSTs and garage/share mutations require the configured Origin. No permissive CORS is enabled. Library CSRF protections remain on. GET verification has an atomic one-use gate.
- Streamed request limits reject oversized/chunked bodies before full buffering. Screenshot uploads are disabled; data URLs and remote image URLs are rejected. Bundled artwork uses an exact species-to-file allowlist.
- Every private data route checks ownership. Retired private/public photo routes always return 404. Public profiles and previews use explicit selected-field projections and independent optional-field gates.
- Nonce script CSP, frame denial, no-sniff, no-referrer, production HSTS, restrictive feature permissions, and no-store private/auth responses.
- Production checks run at actual startup and server instrumentation. Public database endpoints verify TLS; private non-TLS mode is limited to Render's internal hostname.
- Durable SMTP payloads are AES-GCM encrypted with a key derived from the auth secret. Raw mail/token/password logging is disabled. The worker recovers after connection-acquisition failure.
- Git/Docker exclude secrets and local state. Dependencies are locked and audited.

## Operator requirements

Configure HTTPS, secret access/rotation, verified mail sender, least-privilege credentials, database network restrictions, backups, and restore drills before launch. The database contains private emails and password hashes; restrict its administrative access.

Review proxy/platform/error tracking so auth query strings, bodies, cookies, emails, passwords, and authorization headers are not captured. If a mistake exposes them, redact retained logs, rotate affected secrets, and invalidate sessions where appropriate.

Review edge abuse controls before increasing traffic. The conservative global auth cap can affect availability under attack and is not complete DDoS protection. Monitor delivery through provider metrics without copying recipients/message bodies into application logs.

These controls reduce risk; they do not promise breach-proof operation or blanket security-standard compliance.

Legacy photo references and include_photos flags never grant access. Reads strip references, writes clear them, and migration omits images. Existing objects/backups are not deleted by this release.
