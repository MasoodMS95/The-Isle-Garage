import { readFile } from 'node:fs/promises';
import { flushMail } from '../lib/server/mail';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { Pool } from 'pg';
import { readLimitedText } from '../lib/server/runtime';
import { assertProductionConfig } from '../lib/server/config';
import { speciesArtwork, speciesList } from '../lib/species-art';
import { authOptions } from '../lib/auth';
assert.equal(speciesList.length, 22);
assert.equal(speciesArtwork('T-Rex').src, speciesArtwork('Tyrannosaurus').src);
assert.equal(
  speciesArtwork('Pachy').src,
  speciesArtwork('Pachycephalosaurus').src,
);
assert.equal(speciesArtwork('Oviraptor').src, '/dinosaurs/unknown.svg');
const origin = process.env.APP_ORIGIN!;
// No production writes: enforce local test endpoints.
assert.ok(
  ['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ),
);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const received: { to: string; text: string }[] = [];
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['AUTH', 'STARTTLS'],
  logger: false,
  onData(stream, session, callback) {
    simpleParser(stream)
      .then((message) => {
        received.push({
          to: session.envelope.rcptTo[0].address,
          text: message.text || '',
        });
        callback();
      })
      .catch(() => callback(new Error('Mail parse failed')));
  },
});
await new Promise<void>((resolve) => smtp.listen(2529, '127.0.0.1', resolve));
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--port', '3090'],
  {
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
child.stdout.on('data', (chunk) => {
  logs += String(chunk);
});
child.stderr.on('data', (chunk) => {
  logs += String(chunk);
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function client() {
  const cookies = new Map<string, string>();
  return {
    cookies,
    async request(
      path: string,
      method = 'GET',
      body?: unknown,
      extra: Record<string, string> = {},
    ) {
      const response = await fetch(origin + path, {
        redirect: 'manual',
        signal: AbortSignal.timeout(25000),
        method,
        headers: {
          ...(cookies.size
            ? { cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; ') }
            : {}),
          ...(method !== 'GET'
            ? { origin, 'content-type': 'application/json' }
            : {}),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [first] = cookie.split(';');
        const split = first.indexOf('=');
        cookies.set(first.slice(0, split), first.slice(split + 1));
      }
      return response;
    },
  };
}
async function data(response: Response, status = 200) {
  const text = await response.text();
  assert.equal(response.status, status, text.slice(0, 200));
  return JSON.parse(text);
}
async function mail(to: string, after: number) {
  for (let i = 0; i < 100; i++) {
    const item = received.slice(after).find((m) => m.to === to);
    if (item) {
      const url = item.text.match(/https?:\/\/\S+/)?.[0];
      assert.ok(url);
      return new URL(url);
    }
    await sleep(200);
  }
  throw new Error('Local verification mail not received');
}
const run = Date.now().toString(36),
  password = 'Random test passphrase ' + run;
const emailA = 'a-' + run + '@example.test',
  emailB = 'b-' + run + '@example.test';
const anon = client(),
  a = client(),
  b = client();
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break;
    } catch {}
    await sleep(300);
    if (i === 99) throw new Error('Test server not ready');
  }
  let acquisitions = 0;
  await flushMail(async () => {
    acquisitions++;
    throw new Error('Transient test connection failure');
  });
  await flushMail(async () => {
    acquisitions++;
    return pool.connect();
  });
  assert.equal(
    acquisitions,
    2,
    'Mail worker must recover from acquisition failure',
  );
  console.log('Local app, PostgreSQL and SMTP ready.');
  const signup = async (c: ReturnType<typeof client>, email: string) => {
    const before = received.length;
    await data(
      await c.request('/api/auth/sign-up/email', 'POST', {
        name: 'Private owner',
        email,
        password,
        callbackURL: origin + '/login',
      }),
    );
    assert.equal((await c.request('/api/garage')).status, 401);
    const verification = await mail(email, before);
    const path = verification.pathname + verification.search;
    assert.ok([200, 302].includes((await anon.request(path)).status));
    assert.equal(
      (await anon.request(path)).status,
      400,
      'Verification token must be one use',
    );
    const signed = await c.request('/api/auth/sign-in/email', 'POST', {
      email,
      password,
    });
    assert.match(signed.headers.get('set-cookie') || '', /HttpOnly/i);
    assert.match(signed.headers.get('set-cookie') || '', /SameSite=Lax/i);
    return data(signed);
  };
  const accountA = await signup(a, emailA),
    accountB = await signup(b, emailB);
  assert.notEqual(accountA.user.id, accountB.user.id);
  console.log('PASS: verified signup, sessions, single-use verification.');
  const hashes = await pool.query(
    'SELECT password FROM account WHERE "userId"=$1',
    [accountA.user.id],
  );
  assert.match(hashes.rows[0].password, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.ok(!hashes.rows[0].password.includes(password));
  assert.equal((await anon.request('/')).status, 307);
  assert.equal((await anon.request('/api/garage')).status, 401);
  assert.equal(
    (
      await anon.request('/api/garage', 'GET', undefined, {
        'oai-authenticated-user-id': accountA.user.id,
        'oai-authenticated-user-email': emailA,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await a.request(
        '/api/garage',
        'PUT',
        { version: 0, records: [] },
        { origin: 'https://attacker.example' },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await anon.request(
        '/api/auth/sign-in/email',
        'POST',
        { email: emailA, password },
        { origin: 'https://attacker.example' },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await anon.request(
        '/api/auth/sign-in/email',
        'POST',
        { email: emailA, password },
        { origin: '' },
      )
    ).status,
    403,
  );
  const preflight = await anon.request(
    '/api/auth/sign-in/email',
    'OPTIONS',
    undefined,
    { origin: 'https://attacker.example' },
  );
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  const loginPage = await anon.request('/login');
  assert.match(
    loginPage.headers.get('content-security-policy') || '',
    /frame-ancestors 'none'/,
  );
  assert.equal(loginPage.headers.get('referrer-policy'), 'no-referrer');
  let cancelled = false;
  const huge = new Request(origin, {
    method: 'POST',
    body: new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024));
      },
      cancel() {
        cancelled = true;
      },
    }),
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(() => readLimitedText(huge, 100));
  assert.equal(cancelled, true);
  console.log(
    'PASS: CSRF/CORS denial, identity spoof denial, streamed body bounds, security headers.',
  );
  const rec = (id: string, growth: number) => ({
    id,
    name: 'Shared server',
    community: 'Test',
    kind: 'Custom',
    favorite: true,
    state: 'Living',
    species: 'Tyrannosaurus',
    growth,
    code: 'PUBLIC_SKIN',
    photo: '',
  });
  // Existing array-format garage + active selected link before migration.
  const legacyId = crypto.randomUUID().replaceAll('-', '');
  await pool.query(
    'INSERT INTO garages(owner_id,records,version,updated_at) VALUES($1,$2,1,$3)',
    [
      accountA.user.id,
      JSON.stringify([
        {
          ...rec('same', 100),
          photo: '/api/photos/11111111-1111-1111-1111-111111111111',
        },
        rec('zero', 0),
      ]),
      new Date().toISOString(),
    ],
  );
  await pool.query(
    'INSERT INTO shares(id,owner_id,title,selected_ids,active,updated_at) VALUES($1,$2,$3,$4,1,$5)',
    [
      legacyId,
      accountA.user.id,
      'Old limited link',
      '["same"]',
      new Date().toISOString(),
    ],
  );
  let profile = await data(await a.request('/api/profile'));
  assert.equal(profile.visibility, 'private');
  const stableId = profile.id;
  const migration = await readFile(
    'migrations/postgres/002-garage-profiles.sql',
    'utf8',
  );
  await pool.query(migration);
  await pool.query(migration);
  profile = await data(await a.request('/api/profile'));
  assert.equal(profile.id, stableId);
  assert.equal(profile.legacyLinksRevoked, true);
  assert.equal(
    (await pool.query('SELECT active FROM shares WHERE id=$1', [legacyId]))
      .rows[0].active,
    0,
  );
  for (const id of [legacyId, stableId])
    for (const path of ['/api/shared/' + id, '/s/' + id, '/s/' + id + '/image'])
      assert.equal((await anon.request(path)).status, 404);
  assert.equal((await a.request('/s/' + stableId)).status, 404);
  assert.equal((await anon.request('/api/profile')).status, 401);
  assert.equal(
    (
      await anon.request('/api/profile', 'PUT', {
        visibility: 'public',
        version: 0,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await a.request(
        '/api/profile',
        'PUT',
        { visibility: 'public', version: 0 },
        { origin: 'https://attacker.example' },
      )
    ).status,
    403,
  );
  assert.equal((await a.request('/api/shares', 'POST', {})).status, 410);
  assert.equal(
    (await a.request('/api/shares/' + legacyId, 'PATCH', {})).status,
    410,
  );
  let garage = await data(await a.request('/api/garage'));
  assert.equal(garage.records[0].growth, 100);
  assert.equal(garage.records[1].growthMode, 'unknown');
  assert.equal(garage.records[0].photo, '');
  const gameAccounts = [
    ...garage.accounts,
    { id: 'alt', label: 'PUBLIC_ALT_LABEL' },
  ];
  const alt = {
    state: 'Living',
    species: 'Deinosuchus',
    growth: 0,
    growthMode: 'stage',
    growthStage: 'Adult',
    prime: true,
    code: 'PUBLIC_ALT_SKIN',
    photo: '',
  };
  garage = await data(
    await a.request('/api/garage', 'PUT', {
      version: garage.version,
      accounts: gameAccounts,
      records: garage.records.map((r: { id: string }) =>
        r.id === 'same' ? { ...r, dinosaurs: { alt } } : r,
      ),
    }),
  );
  profile = await data(
    await a.request('/api/profile', 'PUT', {
      visibility: 'public',
      version: profile.version,
    }),
  );
  assert.equal(
    (
      await a.request('/api/profile', 'PUT', {
        visibility: 'private',
        version: 0,
      })
    ).status,
    409,
  );
  let view = await data(await anon.request('/api/shared/' + stableId));
  assert.equal(view.records.length, 4);
  assert.deepEqual(view.accountLabels, ['Main', 'PUBLIC_ALT_LABEL']);
  const publicAlt = view.records.find(
    (r: { accountLabel: string; species: string }) =>
      r.accountLabel === 'PUBLIC_ALT_LABEL' && r.species === 'Deinosuchus',
  );
  assert.equal(publicAlt.growthStage, 'Adult');
  assert.equal(publicAlt.prime, true);
  assert.equal(publicAlt.code, 'PUBLIC_ALT_SKIN');
  for (const secret of [
    emailA,
    emailB,
    'Private owner',
    accountA.user.id,
    accountB.user.id,
    '/api/photos/',
    'owner_id',
    'password',
  ])
    assert.ok(!JSON.stringify(view).includes(secret));
  await pool.query(migration);
  assert.equal(
    (await data(await a.request('/api/profile'))).visibility,
    'public',
    'Repeated startup must not reset chosen visibility',
  );
  assert.equal((await anon.request('/api/shared/' + legacyId)).status, 404);
  const html = await (await anon.request('/s/' + stableId)).text();
  assert.match(html, /PRIME/);
  assert.match(html, /Adult/);
  assert.match(html, /og:image/);
  assert.ok(!html.includes(emailA));
  const image = await anon.request('/s/' + stableId + '/image');
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') || '', /image\/png/);
  await image.arrayBuffer();
  const futureAccounts = [
    ...gameAccounts,
    { id: 'future', label: 'Future account' },
  ];
  garage = await data(
    await a.request('/api/garage', 'PUT', {
      version: garage.version,
      accounts: futureAccounts,
      records: [...garage.records, rec('future-server', 42)],
    }),
  );
  view = await data(await anon.request('/api/shared/' + stableId));
  assert.equal(view.records.length, 9);
  assert.ok(view.accountLabels.includes('Future account'));
  assert.ok(view.records.some((r: { growth: number }) => r.growth === 42));
  let other = await data(await b.request('/api/profile'));
  assert.notEqual(other.id, stableId);
  assert.equal(other.visibility, 'private');
  // Submitted foreign IDs cannot change the caller-bound owner selection.
  other = await data(
    await b.request('/api/profile', 'PUT', {
      visibility: 'public',
      version: other.version,
      id: stableId,
      ownerId: accountA.user.id,
    }),
  );
  assert.notEqual(other.id, stableId);
  assert.equal(
    (await data(await a.request('/api/profile'))).version,
    profile.version,
  );
  assert.deepEqual(
    (await data(await anon.request('/api/shared/' + other.id))).records,
    [],
  );
  for (const photo of [
    'data:image/png;base64,AAAA',
    'https://attacker.example/private.png',
  ])
    assert.equal(
      (
        await a.request('/api/garage', 'PUT', {
          version: garage.version,
          accounts: futureAccounts,
          records: [{ ...garage.records[0], photo }],
        })
      ).status,
      400,
    );
  assert.equal(
    (await a.request('/api/garage', 'PUT', { version: 0, records: [] })).status,
    409,
  );
  for (const species of [...speciesList, 'Custom dinosaur', '../../private']) {
    const response = await anon.request(speciesArtwork(species).src);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<svg/);
  }
  for (const c of [a, b, anon])
    assert.equal(
      (await c.request('/api/photos/11111111-1111-1111-1111-111111111111'))
        .status,
      404,
    );
  profile = await data(
    await a.request('/api/profile', 'PUT', {
      visibility: 'private',
      version: profile.version,
    }),
  );
  for (const c of [a, b, anon])
    for (const path of [
      '/api/shared/' + stableId,
      '/s/' + stableId,
      '/s/' + stableId + '/image',
    ])
      assert.equal((await c.request(path)).status, 404);
  assert.equal((await data(await a.request('/api/profile'))).id, stableId);
  assert.equal((await a.request('/api/shared/' + emailA)).status, 404);
  const concurrent = await Promise.all(
    Array.from({ length: 4 }, () =>
      a.request('/api/profile').then((r) => r.json()),
    ),
  );
  assert.ok(concurrent.every((p) => p.id === stableId));
  console.log(
    'PASS: stable private-by-default profiles, race-safe IDs, whole/future garage projection, no auth exposure, legacy retirement/idempotent migration, cross-owner and stale-write protection, private page/API/OG denial.',
  );
  const before = received.length;
  await data(
    await anon.request('/api/auth/request-password-reset', 'POST', {
      email: emailA,
      redirectTo: origin + '/reset-password',
    }),
  );
  const reset = await mail(emailA, before);
  const resetResponse = await anon.request(reset.pathname + reset.search);
  const target = new URL(resetResponse.headers.get('location')!, origin),
    token = target.searchParams.get('token');
  assert.ok(token);
  const newPassword = password + ' changed';
  await data(
    await anon.request('/api/auth/reset-password', 'POST', {
      token,
      newPassword,
    }),
  );
  assert.equal(
    (await a.request('/api/garage')).status,
    401,
    'Reset must revoke previous sessions',
  );
  assert.ok(
    !(
      await anon.request('/api/auth/reset-password', 'POST', {
        token,
        newPassword: password,
      })
    ).ok,
    'Reset token must be single-use',
  );
  const expired = await anon.request('/api/auth/reset-password', 'POST', {
    token: 'expired-invalid-token',
    newPassword,
  });
  assert.ok(!expired.ok);
  await data(
    await a.request('/api/auth/sign-in/email', 'POST', {
      email: emailA,
      password: newPassword,
    }),
  );
  await data(await a.request('/api/auth/sign-out', 'POST', {}));
  assert.equal((await a.request('/api/garage')).status, 401);
  const failureStatuses = [];
  for (let i = 0; i < 6; i++)
    failureStatuses.push(
      (
        await anon.request(
          '/api/auth/sign-in/email',
          'POST',
          {
            email: 'rate-' + run + '@example.test',
            password: 'incorrect password',
          },
          { 'x-forwarded-for': '1.2.3.' + i, 'x-garage-rate-ip': '8.8.8.' + i },
        )
      ).status,
    );
  assert.equal(failureStatuses.at(-1), 429);
  assert.ok(
    (await pool.query('SELECT COUNT(*)::int AS n FROM auth_throttle')).rows[0]
      .n > 0,
  );
  assert.ok(
    (await pool.query('SELECT COUNT(*)::int AS n FROM "rateLimit"')).rows[0].n >
      0,
  );
  const generic = await data(
    await anon.request('/api/auth/request-password-reset', 'POST', {
      email: 'missing-' + run + '@example.test',
      redirectTo: origin + '/reset-password',
    }),
  );
  assert.ok(generic);
  const savedEnv = { ...process.env };
  Object.assign(process.env, { NODE_ENV: 'production' });
  process.env.APP_ORIGIN = 'https://garage.example.test';
  assert.throws(() => assertProductionConfig());
  Object.assign(process.env, {
    DATABASE_SSL: 'verify-full',
    SMTP_USER: 'test-only',
    SMTP_PASSWORD: 'test-only',
    SMTP_ALLOW_INSECURE: 'false',
  });
  for (const key of Object.keys(process.env))
    if (key.startsWith('S3_')) delete process.env[key];
  assert.doesNotThrow(
    () => assertProductionConfig(),
    'Production requires no object storage settings',
  );
  const options = authOptions();
  assert.equal(options.advanced?.useSecureCookies, true);
  assert.equal(options.emailAndPassword?.requireEmailVerification, true);
  process.env = savedEnv;
  assert.ok(!logs.includes(password));
  assert.ok(!logs.includes(emailA));
  assert.ok(!logs.includes(token!));
  console.log(
    'PASS: Argon2id policy, reset/session revocation, one-use reset, logout, durable throttles, no secrets in logs, production guards.',
  );
} finally {
  child.kill('SIGTERM');
  await pool.end();
  await new Promise<void>((resolve) => smtp.close(() => resolve()));
}
