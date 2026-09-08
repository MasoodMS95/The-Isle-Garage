import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { databasePool } from '../lib/server/database';
import {
  clientRecords,
  clientAccounts,
  validateRecords,
  validateAccounts,
  shareInput,
  type GarageRow,
} from '../lib/server/garage';
const args = process.argv.slice(2),
  value = (key: string) => args[args.indexOf(key) + 1];
for (const key of ['--directory', '--legacy-owner', '--new-owner'])
  if (!args.includes(key))
    throw new Error(
      'Required: --directory --legacy-owner --new-owner --confirm-owner-map',
    );
if (!args.includes('--confirm-owner-map'))
  throw new Error(
    'Administrator must confirm proof of both owner identities before import',
  );
const directory = path.resolve(value('--directory'));
const manifest = JSON.parse(
  await readFile(path.join(directory, 'manifest.json'), 'utf8'),
);
if (
  manifest.format !== 1 ||
  manifest.legacyOwnerId !== value('--legacy-owner') ||
  manifest.garage.owner_id !== manifest.legacyOwnerId
)
  throw new Error('Legacy owner mismatch');
const newOwner = value('--new-owner');
const connection = await databasePool().connect();
try {
  await connection.query('BEGIN');
  const user = await connection.query(
    'SELECT id FROM "user" WHERE id=$1 AND "emailVerified"=true',
    [newOwner],
  );
  if (!user.rowCount)
    throw new Error(
      'Target account must exist and have verified email; matching emails is not ownership proof',
    );
  const existing = await connection.query(
    'SELECT owner_id FROM garages WHERE owner_id=$1',
    [newOwner],
  );
  if (existing.rowCount)
    throw new Error('Target garage already exists; refusing overwrite');
  const row = manifest.garage as GarageRow;
  const accounts = validateAccounts(clientAccounts(row), [
    { id: 'main', label: 'Main' },
  ]);
  const incoming = clientRecords(row) || [];
  const records = await validateRecords(incoming, [], accounts);
  const now = new Date().toISOString();
  await connection.query(
    'INSERT INTO garages(owner_id,records,version,updated_at) VALUES($1,$2,1,$3)',
    [newOwner, JSON.stringify({ accounts, servers: records }), now],
  );
  if (!Array.isArray(manifest.shares) || manifest.shares.length > 500)
    throw new Error('Invalid share backup');
  for (const raw of manifest.shares) {
    if (
      raw.owner_id !== manifest.legacyOwnerId ||
      !/^[a-f0-9]{32}$/.test(raw.id)
    )
      throw new Error('Share owner or ID mismatch');
    const selected = JSON.parse(raw.selected_ids);
    const input = shareInput(
      {
        title: raw.title,
        selectedIds: Array.isArray(selected) ? selected : selected.ids,
        includeCodes: !!raw.include_codes,
        includeAccountLabels: Array.isArray(selected)
          ? false
          : !!selected.includeAccountLabels,
      },
      records,
      accounts,
    );
    await connection.query(
      'INSERT INTO shares(id,owner_id,title,selected_ids,include_codes,include_photos,active,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        raw.id,
        newOwner,
        input.title,
        JSON.stringify({
          ids: input.selectedIds,
          includeAccountLabels: input.includeAccountLabels,
        }),
        input.includeCodes,
        input.includePhotos,
        0, // Imported selected links stay retired; profile remains private.
        now,
      ],
    );
  }
  await connection.query('COMMIT');
  console.log(
    'Garage imported into the explicitly mapped account. Old hosted data unchanged.',
  );
} catch (error) {
  await connection.query('ROLLBACK');
  throw error;
} finally {
  connection.release();
  await databasePool().end();
}
