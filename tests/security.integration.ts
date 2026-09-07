import { flushMail } from '../lib/server/mail';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { Pool } from 'pg';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { readLimitedText } from '../lib/server/runtime';
import { assertProductionConfig } from '../lib/server/config';
import { authOptions } from '../lib/auth';
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
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
try {
  await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
} catch (error) {
  if (
    !['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(
      (error as Error).name,
    )
  )
    throw error;
}
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
    code: 'SECRET_SKIN',
    photo: '',
  });
  // Seed actual pre-upgrade D1 JSON shape, preserving old ownership after explicit administrator mapping.
  await pool.query(
    'INSERT INTO garages(owner_id,records,version,updated_at) VALUES($1,$2,1,$3)',
    [
      accountA.user.id,
      JSON.stringify([rec('same', 100), rec('zero', 0)]),
      new Date().toISOString(),
    ],
  );
  let garage = await data(await a.request('/api/garage'));
  assert.equal(garage.accounts[0].id, 'main');
  assert.equal(garage.records[0].growth, 100);
  assert.equal(garage.records[1].growthMode, 'unknown');
  const gameAccounts = [
    ...garage.accounts,
    { id: 'alt', label: 'HIDDEN_GAME_LABEL' },
  ];
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZAAAAAASUVORK5CYII=';
  const alt = {
    state: 'Living',
    species: 'Deinosuchus',
    growth: 0,
    growthMode: 'stage',
    growthStage: 'Adult',
    prime: true,
    code: 'ALT_SECRET',
    photo: png,
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
  assert.equal(garage.records[0].growth, 100);
  await data(
    await b.request('/api/garage', 'PUT', {
      version: 0,
      records: [rec('b', 1)],
    }),
  );
  const shared = await data(
    await a.request('/api/shares', 'POST', {
      title: 'Public profile',
      selectedIds: ['alt:same'],
      includeCodes: false,
      includePhotos: false,
      includeAccountLabels: false,
    }),
    201,
  );
  const view = await data(await anon.request('/api/shared/' + shared.id));
  assert.equal(view.records.length, 1);
  assert.equal(view.records[0].growthStage, 'Adult');
  assert.equal(view.records[0].prime, true);
  for (const secret of [
    emailA,
    emailB,
    'Private owner',
    'HIDDEN_GAME_LABEL',
    'ALT_SECRET',
    'SECRET_SKIN',
    accountA.user.id,
  ])
    assert.ok(!JSON.stringify(view).includes(secret));
  const html = await (await anon.request('/s/' + shared.id)).text();
  assert.match(html, /PRIME/);
  assert.match(html, /Adult/);
  assert.match(html, /og:image/);
  assert.ok(!html.includes(emailA));
  const image = await anon.request('/s/' + shared.id + '/image');
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type') || '', /image\/png/);
  await image.arrayBuffer();
  assert.equal(
    (await b.request('/api/shares/' + shared.id, 'DELETE', {})).status,
    404,
  );
  const privatePhoto = garage.records[0].dinosaurs.alt.photo;
  assert.equal((await anon.request(privatePhoto)).status, 401);
  assert.equal((await b.request(privatePhoto)).status, 404);
  await data(
    await a.request('/api/shares/' + shared.id, 'PATCH', {
      title: 'Public profile',
      selectedIds: ['alt:same'],
      includeCodes: false,
      includePhotos: true,
      includeAccountLabels: false,
    }),
  );
  const photoView = await data(await anon.request('/api/shared/' + shared.id));
  assert.match(photoView.records[0].photo, /alt%3Asame/);
  assert.equal((await anon.request(photoView.records[0].photo)).status, 200);
  assert.equal(
    (await anon.request('/s/' + shared.id + '/photo/same')).status,
    404,
  );
  assert.equal(
    (
      await a.request('/api/garage', 'PUT', {
        version: garage.version,
        accounts: gameAccounts,
        records: [{ ...garage.records[0], growthMode: 'percent', growth: 0 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await a.request('/api/garage', 'PUT', { version: 0, records: [] })).status,
    409,
  );
  await data(await a.request('/api/shares/' + shared.id, 'DELETE', {}));
  assert.equal((await anon.request('/api/shared/' + shared.id)).status, 404);
  assert.equal((await anon.request(photoView.records[0].photo)).status, 404);
  assert.equal((await anon.request('/s/' + shared.id + '/image')).status, 404);
  console.log(
    'PASS: legacy/account migration, owner isolation, private DTO, Prime/OG, S3 screenshot/revocation.',
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
  s3.destroy();
  await new Promise<void>((resolve) => smtp.close(() => resolve()));
}
