# Legacy data migration

The old hosted site is untouched. These tools do not connect to it or fetch private data.

## Prerequisites

Obtain an authorized, consistent D1/SQLite backup . No hosted export credential is available in this repository. Do not make private APIs public to obtain data.

Create and verify the destination account. Independently prove control of both the old garage and new account; matching emails alone are not proof. Record the explicit old Site owner ID to new auth user ID mapping privately.

## Export one owner

```sh
python3 scripts/export-legacy.py --database /private/backup.sqlite --legacy-owner OLD_ID --output /private/owner-export
```

Export reads SQLite in read-only mode, selects one owner's records/shares, strips retired screenshot references and disables their legacy sharing flag. It refuses existing output directories. No object export is required. Secure the resulting private directory.

## Import

Back up the destination database. Use server-side environment settings.

```sh
node --env-file=.env --import tsx scripts/import-legacy.ts --directory /private/owner-export --legacy-owner OLD_ID --new-owner VERIFIED_NEW_ID --confirm-owner-map
```

The importer checks the owner mapping, verified destination, validation, and selections. It refuses an existing destination garage or colliding share IDs. Database rows commit together. Images are not read or imported; even older manifests have screenshot references stripped. Source data and objects remain untouched.

Legacy records become Main; 100 remains 100, zero remains unknown. Game-account IDs and legacy share rows/IDs are retained for audit, but imported selected links are inactive and unavailable. Discord synchronization is not triggered.

The new whole-garage profile uses a new stable opaque ID and starts Private. Old /s/SHARE_ID links return404 and are never redirected to broader data. The sharing panel explains retirement of previously active links.

Verify record counts, static artwork, ownership, the new profile's default privacy, and visibility changes after import. Keep the old service/backups until acceptance. This is not automatic email-based linking or merging.

Migration002 is idempotent: it creates one private profile for each existing auth user, retires selected links and records a migration notice. It does not reset existing profile IDs or chosen visibility on subsequent deploys. No garage records or auth accounts are deleted.

## Public usernames

Migration `003-public-handles.sql` adds a permanent provisional alias and an optional one-time chosen handle with database uniqueness. Existing profile IDs, Public/Private choices and garage contents are preserved. Run the normal migration command before starting the new runtime. Repeated runs preserve chosen handles; provisional aliases remain reserved to the same profile. No authentication names or emails are copied into public handles. Old opaque profile routes redirect only after checking public visibility; retired selected-record links remain unavailable.
