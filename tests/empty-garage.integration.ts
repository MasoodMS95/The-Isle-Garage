import assert from 'node:assert/strict';
import { Pool } from 'pg';
const origin = process.env.APP_ORIGIN!;
assert.equal(new URL(origin).hostname, 'localhost');
assert.ok(
  ['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
);
const email = 'empty-' + Date.now() + '@example.test';
const password = 'Local empty garage regression 2026!';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let cookie = '';
async function request(path: string, method = 'GET', body?: unknown) {
  return fetch(origin + path, {
    method,
    headers: { origin, 'content-type': 'application/json', cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
try {
  assert.equal(
    (
      await request('/api/auth/sign-up/email', 'POST', {
        name: 'Empty garage test',
        email,
        password,
      })
    ).status,
    200,
  );
  await pool.query('UPDATE "user" SET "emailVerified"=true WHERE email=$1', [
    email,
  ]);
  const signed = await request('/api/auth/sign-in/email', 'POST', {
    email,
    password,
  });
  assert.equal(signed.status, 200);
  cookie = signed.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const fresh = await (await request('/api/garage')).json();
  assert.equal(fresh.records, null);
  assert.deepEqual(fresh.accounts, [{ id: 'main', label: 'Main' }]);
  const emptyPage = await (await request('/')).text();
  assert.ok(emptyPage.includes('Your garage is empty'));
  assert.ok(!emptyPage.includes('class="server-card'));
  for (const sample of ['Unsaved sample garage', 'Sample record'])
    assert.ok(!emptyPage.includes(sample), sample);
  const record = {
    id: 'official-eu1',
    name: 'Official EU 1',
    community: 'The Isle Official',
    kind: 'Official',
    favorite: true,
    state: 'Living',
    species: 'Tyrannosaurus',
    growth: 83,
    growthMode: 'percent',
    prime: true,
    code: 'USER_SAVED_SKIN',
    photo: '',
  };
  const saved = await request('/api/garage', 'PUT', {
    version: 0,
    accounts: fresh.accounts,
    records: [record],
  });
  assert.equal(saved.status, 200);
  const reloaded = await (await request('/api/garage')).json();
  assert.equal(reloaded.records.length, 1);
  assert.equal(reloaded.records[0].growth, 83);
  assert.equal(reloaded.records[0].prime, true);
  assert.equal(reloaded.records[0].code, 'USER_SAVED_SKIN');
  const page = await (await request('/')).text();
  assert.ok(page.includes('Official EU 1'));
  assert.ok(!page.includes('Your garage is empty'));
  console.log(
    'PASS: new garage starts empty; explicitly saved records survive reload even when resembling former demo data.',
  );
} finally {
  await pool.end();
}
