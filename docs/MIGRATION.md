# Legacy data migration

The old hosted site is untouched. These tools do not connect to it or fetch private data.

## Prerequisites

Obtain an authorized, consistent D1/SQLite backup and private R2 object export. No hosted export credential is available in this repository. Do not make private APIs public to obtain data.

Create and verify the destination account. Independently prove control of both the old garage and new account; matching emails alone are not proof. Record the explicit old Site owner ID to new auth user ID mapping privately.

## Export one owner

```sh
python3 scripts/export-legacy.py --database /private/backup.sqlite --legacy-owner OLD_ID --photos-directory /private/r2-export --output /private/owner-export
```

Object exports must retain the old OWNER_ID/PHOTO_UUID layout. Export reads SQLite in read-only mode, selects one owner's records/shares, and copies referenced images. It refuses missing images and existing output directories. Secure the resulting private directory.

## Import

Back up the destination database and bucket. Use server-side environment settings.

```sh
node --env-file=.env --import tsx scripts/import-legacy.ts --directory /private/owner-export --legacy-owner OLD_ID --new-owner VERIFIED_NEW_ID --confirm-owner-map
```

The importer checks the owner mapping, verified destination, validation, and selections. It refuses an existing destination garage or colliding share IDs. Database rows commit together; images upload privately. Failure can leave unreferenced private images for verified administrative cleanup.

Legacy records become Main; 100 remains 100, zero remains unknown. Account IDs and share IDs/scopes are retained. Discord synchronization is not triggered.

The /s/SHARE_ID **path** can survive; the old Sites hostname does not automatically redirect. Share new URLs unless a separately authorized domain/redirect migration is arranged.

Verify record counts, screenshots, ownership, a selected link, and revocation after import. Keep the old service/backups until acceptance. This is not automatic email-based linking or merging.
