import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import {
  forAccount,
  saveAccountView,
  growthText,
  recordSummary,
} from '../lib/garage-model.ts';
const base = process.env.TEST_ORIGIN || 'http://localhost:8788';
const id = 'legacy_accounts_owner',
  legacyShare = 'abcdefabcdefabcdefabcdefabcdefab';
const record = (key, growth) => ({
  id: key,
  name: 'Server ' + key,
  community: 'Test',
  kind: 'Custom',
  favorite: true,
  state: 'Living',
  species: 'Tyrannosaurus',
  growth,
  code: '',
  photo: '',
});
if (process.argv.includes('--seed')) {
  const records = [record('same', 100), record('zero', 0)];
  const esc = (s) => "'" + s.replaceAll("'", "''") + "'";
  writeFileSync(
    'outputs/accounts-legacy.sql',
    [
      'INSERT OR REPLACE INTO garages(owner_id,records,version,updated_at) VALUES (' +
        esc(id) +
        ',' +
        esc(JSON.stringify(records)) +
        ",1,'2026-01-01T00:00:00.000Z');",
      'INSERT OR REPLACE INTO shares(id,owner_id,title,selected_ids,include_codes,include_photos,active,updated_at) VALUES (' +
        esc(legacyShare) +
        ',' +
        esc(id) +
        ",'Legacy Main only'," +
        esc(JSON.stringify(['same'])) +
        ",0,0,1,'2026-01-01T00:00:00.000Z');",
    ].join(String.fromCharCode(10)),
  );
  process.exit(0);
}
async function req(path, method = 'GET', body, owner = id) {
  const r = await fetch(base + path, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    headers: {
      ...(owner
        ? {
            'oai-authenticated-user-id': owner,
            'oai-authenticated-user-email': owner + '@example.test',
          }
        : {}),
      ...(method !== 'GET'
        ? { origin: base, 'content-type': 'application/json' }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const bytes = await r.arrayBuffer();
  return new Response(bytes, { status: r.status, headers: r.headers });
}
async function data(r, status = 200) {
  const text = await r.text();
  assert.equal(r.status, status, text);
  return JSON.parse(text);
}
const publicView = (key) =>
  req('/api/shared/' + key, 'GET', undefined, null).then(data);
let garage = await data(await req('/api/garage'));
assert.deepEqual(garage.accounts, [{ id: 'main', label: 'Main' }]);
assert.equal(garage.records[0].growth, 100);
assert.equal(garage.records[0].growthMode, 'percent');
assert.equal(garage.records[1].growth, 0);
assert.equal(garage.records[1].growthMode, 'unknown');
assert.equal(growthText(garage.records[1]), 'Unknown');
const initial = await publicView(legacyShare);
assert.equal(initial.records[0].growth, 100);
assert.equal(initial.records[0].accountLabel, undefined);
let accounts = [...garage.accounts, { id: 'alt', label: 'PRIVATE_ALT_LABEL' }];
const alt = {
  state: 'Living',
  species: 'Deinosuchus',
  growth: 0,
  growthMode: 'stage',
  growthStage: 'Adult',
  prime: true,
  code: 'ALT_PRIVATE_SKIN',
  photo: '',
};
let records = garage.records.map((s) =>
  s.id === 'same' ? { ...s, dinosaurs: { alt } } : s,
);
garage = await data(
  await req('/api/garage', 'PUT', {
    version: garage.version,
    records,
    accounts,
  }),
);
assert.equal(garage.records[0].growth, 100);
assert.equal(garage.records[0].dinosaurs.alt.growthStage, 'Adult');
assert.equal(forAccount(garage.records[1], 'alt').state, 'No dinosaur');
const projected = forAccount(garage.records[0], 'alt');
assert.equal(projected.species, 'Deinosuchus');
const edited = saveAccountView(
  garage.records,
  garage.records.map((s) => ({
    ...forAccount(s, 'alt'),
    favorite: s.id === 'same' ? false : s.favorite,
  })),
  'alt',
);
assert.equal(edited[0].growth, 100);
assert.equal(edited[0].dinosaurs.alt.prime, true);
assert.equal(forAccount(edited[0], 'main').favorite, false);
const old = await publicView(legacyShare);
assert.equal(old.records.length, 1);
assert.equal(old.records[0].species, 'Tyrannosaurus');
assert.equal(old.records[0].prime, false);
assert.ok(!JSON.stringify(old).includes('PRIVATE_ALT'));
const create = (options) =>
  req('/api/shares', 'POST', {
    title: 'Account test',
    selectedIds: ['alt:same'],
    includeCodes: false,
    includePhotos: false,
    ...options,
  }).then((r) => data(r, 201));
const shared = await create({});
let view = await publicView(shared.id);
assert.equal(view.records[0].prime, true);
assert.equal(view.records[0].growthStage, 'Adult');
assert.equal(view.records[0].code, undefined);
assert.equal(view.records[0].accountLabel, undefined);
let html = await (await req('/s/' + shared.id, 'GET', undefined, null)).text();
assert.match(html, /PRIME/);
assert.match(html, /Adult/);
assert.ok(!html.includes('PRIVATE_ALT_LABEL'));
assert.ok(!html.includes('ALT_PRIVATE_SKIN'));
assert.match(recordSummary(view.records[0]), /PRIME.*Adult/);
const image = await req('/s/' + shared.id + '/image', 'GET', undefined, null);
assert.equal(image.status, 200);
assert.match(image.headers.get('content-type'), /image\/png/);
const before = Buffer.from(await image.arrayBuffer());
assert.equal(
  (
    await req(
      '/api/shares/' + shared.id,
      'PATCH',
      {
        title: 'No',
        selectedIds: ['same'],
        includeCodes: false,
        includePhotos: false,
      },
      'other-owner',
    )
  ).status,
  404,
);
for (const bad of [
  { ...garage.records[0], growthMode: 'percent', growth: 0 },
  { ...garage.records[0], growthMode: 'percent', growth: 101 },
  { ...garage.records[0], growthMode: 'stage', growthStage: 'Elder' },
  { ...garage.records[0], prime: 'yes' },
  { ...garage.records[0], dinosaurs: { stranger: alt } },
])
  assert.equal(
    (
      await req('/api/garage', 'PUT', {
        version: garage.version,
        accounts,
        records: [bad],
      })
    ).status,
    400,
  );
assert.equal(
  (
    await req('/api/shares', 'POST', {
      title: 'bad',
      selectedIds: ['absent:same'],
      includeCodes: false,
      includePhotos: false,
    })
  ).status,
  400,
);
accounts = accounts.map((a) =>
  a.id === 'alt' ? { ...a, label: 'Renamed private account' } : a,
);
records = garage.records.map((s) =>
  s.id === 'same'
    ? {
        ...s,
        dinosaurs: {
          alt: {
            ...s.dinosaurs.alt,
            growthMode: 'percent',
            growth: 1,
            growthStage: '',
            prime: false,
          },
        },
      }
    : s,
);
garage = await data(
  await req('/api/garage', 'PUT', {
    version: garage.version,
    records,
    accounts,
  }),
);
view = await publicView(shared.id);
assert.equal(view.records[0].growth, 1);
assert.equal(view.records[0].growthMode, 'percent');
assert.equal(view.records[0].growthStage, '');
assert.equal(view.records[0].prime, false);
assert.equal(view.records[0].accountLabel, undefined);
assert.equal((await publicView(legacyShare)).records[0].growth, 100);
const after = Buffer.from(
  await (
    await req('/s/' + shared.id + '/image', 'GET', undefined, null)
  ).arrayBuffer(),
);
assert.notDeepEqual(before, after);
await data(
  await req('/api/shares/' + shared.id, 'PATCH', {
    title: 'Account test',
    selectedIds: ['alt:same'],
    includeCodes: false,
    includePhotos: false,
    includeAccountLabels: true,
  }),
);
view = await publicView(shared.id);
assert.equal(view.records[0].accountLabel, 'Renamed private account');
for (const stage of ['Juvie', 'Adolescent', 'Adult', 'Full grown']) {
  records = garage.records.map((s) =>
    s.id === 'same'
      ? {
          ...s,
          dinosaurs: {
            alt: {
              ...s.dinosaurs.alt,
              growthMode: 'stage',
              growth: 0,
              growthStage: stage,
              prime: true,
            },
          },
        }
      : s,
  );
  garage = await data(
    await req('/api/garage', 'PUT', {
      version: garage.version,
      records,
      accounts,
    }),
  );
  assert.equal((await publicView(shared.id)).records[0].growthStage, stage);
}
assert.equal(
  (
    await req('/api/garage', 'PUT', {
      version: garage.version,
      records: garage.records,
      accounts: [accounts[0]],
    })
  ).status,
  400,
);
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZAAAAAASUVORK5CYII=';
records = garage.records.map((s) =>
  s.id === 'same'
    ? { ...s, dinosaurs: { alt: { ...s.dinosaurs.alt, photo: png } } }
    : s,
);
garage = await data(
  await req('/api/garage', 'PUT', {
    version: garage.version,
    records,
    accounts,
  }),
);
await data(
  await req('/api/shares/' + shared.id, 'PATCH', {
    title: 'Alt screenshot',
    selectedIds: ['alt:same'],
    includeCodes: false,
    includePhotos: true,
    includeAccountLabels: false,
  }),
);
view = await publicView(shared.id);
assert.match(view.records[0].photo, /alt%3Asame/);
const photoPath = view.records[0].photo;
assert.equal((await req(photoPath, 'GET', undefined, null)).status, 200);
assert.equal(
  (await req('/s/' + shared.id + '/photo/same', 'GET', undefined, null)).status,
  404,
);
assert.equal(
  (await req('/s/' + shared.id + '/image', 'GET', undefined, null)).status,
  200,
);
const privatePhoto = garage.records[0].dinosaurs.alt.photo;
assert.equal(
  (await req(privatePhoto, 'GET', undefined, 'other-owner')).status,
  404,
);
assert.equal((await req(privatePhoto, 'GET', undefined, null)).status, 401);
assert.equal(
  (
    await req('/api/garage', 'PUT', {
      version: garage.version,
      accounts,
      records: garage.records.map((s) =>
        s.id === 'same' ? { ...s, photo: privatePhoto } : s,
      ),
    })
  ).status,
  400,
);
records = garage.records.map((s) =>
  s.id === 'same'
    ? { ...s, dinosaurs: { alt: { ...s.dinosaurs.alt, state: 'No dinosaur' } } }
    : s,
);
garage = await data(
  await req('/api/garage', 'PUT', {
    version: garage.version,
    records,
    accounts,
  }),
);
view = await publicView(shared.id);
assert.equal(view.records[0].state, 'No dinosaur');
assert.equal(view.records[0].prime, false);
assert.equal(view.records[0].photo, undefined);
assert.equal(garage.records[0].favorite, true);
assert.equal(garage.records[0].growth, 100);
assert.equal((await req(photoPath, 'GET', undefined, null)).status, 404);
await data(await req('/api/shares/' + shared.id, 'DELETE', {}));
assert.equal(
  (await req('/api/shared/' + shared.id, 'GET', undefined, null)).status,
  404,
);
assert.equal(
  (await req('/s/' + shared.id + '/image', 'GET', undefined, null)).status,
  404,
);
console.log(
  'PASS: persisted legacy migration incl 0/100, Main-only legacy share, same-server account isolation, shared favorites, rename stability, growth bounds/stages, Prime opt-in record projection and PNG changes, private labels, owner isolation, encoded Alt screenshot and clear isolation, revocation.',
);
