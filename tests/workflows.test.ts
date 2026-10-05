import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import QRCode from 'qrcode';
import { createApp } from '../server/app.js';
import { MemoryStore } from '../server/store.js';
import { hash, token, passwordHash, verifyPassword, resetTokenPurpose } from '../server/security.js';

const credentials = { name: 'Acceptance User', email: 'acceptance@example.com', password: 'A secure acceptance password 123' };
async function mailFixture(run: (sent: any[], failNext: () => void) => Promise<void>) {
  const before = [process.env.BREVO_API_KEY, process.env.BREVO_SENDER_EMAIL], originalFetch = globalThis.fetch;
  process.env.BREVO_API_KEY = 'mock-only';
  process.env.BREVO_SENDER_EMAIL = 'mock-sender@example.com';
  const sent: any[] = [];
  let failing = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.brevo.com/v3/smtp/email', 'Unexpected external request');
    sent.push(JSON.parse(String(options?.body)));
    const status = failing ? 503 : 201;
    failing = false;
    return new Response('{}', { status });
  };
  try { await run(sent, () => { failing = true; }); }
  finally {
    globalThis.fetch = originalFetch;
    for (const [index, key] of ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL'].entries()) {
      if (before[index] === undefined) delete process.env[key]; else process.env[key] = before[index];
    }
  }
}
function mailToken(mail: any): string {
  const link = mail.textContent.split('\n').find((line: string) => line.startsWith('http'));
  return new URL(link).searchParams.get('token')!;
}

test('verification and reset links work through mocked delivery, invalidate sessions and preserve token purpose', async () => {
  await mailFixture(async (sent) => {
    const store = new MemoryStore(), app = createApp(store), first = request.agent(app), second = request.agent(app);
    const registered = await first.post('/api/auth/register').send(credentials).expect(201);
    assert.equal(registered.body.emailSent, true);
    assert(!JSON.stringify(registered.body).includes('passwordHash'));
    const verification = mailToken(sent[0]);
    await first.post('/api/auth/confirm').send({ token: verification, purpose: 'reset', password: 'Another secure password 456' }).expect(400);
    await first.post('/api/auth/confirm').send({ token: verification, purpose: 'verify' }).expect(200);
    assert.equal((await first.get('/api/me').expect(200)).body.verified, true);
    await first.post('/api/auth/confirm').send({ token: verification, purpose: 'verify' }).expect(400);
    await second.post('/api/auth/login').send(credentials).expect(200);
    const known = await first.post('/api/auth/forgot').send({ email: credentials.email }).expect(200);
    const reset = mailToken(sent.at(-1));
    const count = sent.length;
    const unknown = await first.post('/api/auth/forgot').send({ email: 'absent@example.com' }).expect(200);
    assert.deepEqual(unknown.body, known.body);
    assert.equal(sent.length, count);
    await first.post('/api/auth/confirm').send({ token: reset, purpose: 'reset' }).expect(400);
    await first.post('/api/auth/confirm').send({ token: reset, purpose: 'reset', password: 'Replacement secure password 456' }).expect(200);
    await first.get('/api/me').expect(401);
    await second.get('/api/me').expect(401);
    await first.post('/api/auth/login').send(credentials).expect(401);
    await first.post('/api/auth/login').send({ ...credentials, password: 'Replacement secure password 456' }).expect(200);
    await first.post('/api/auth/confirm').send({ token: reset, purpose: 'reset', password: 'Yet another password 789' }).expect(400);
  });
});

test('trusted alerts enforce ownership, send only summaries and record failed delivery', async () => {
  await mailFixture(async (sent, failNext) => {
    const store = new MemoryStore(), app = createApp(store), a = request.agent(app), b = request.agent(app);
    await a.post('/api/auth/register').send(credentials).expect(201);
    await b.post('/api/auth/register').send({ ...credentials, email: 'other-acceptance@example.com' }).expect(201);
    for (const user of await store.list('users')) await store.update('users', user.id, { verified: true });
    const scan = await a.post('/api/scans').send({ kind: 'message', text: 'Enter OTP 123456 at https://bkash-verify.example/reset/private?token=secret.' }).expect(200);
    const own = await a.post('/api/contacts').send({ name: 'Trusted Person', email: 'trusted@example.com' }).expect(201);
    const foreign = await b.post('/api/contacts').send({ name: 'Other Contact', email: 'other-contact@example.com' }).expect(201);
    const before = sent.length;
    await b.post('/api/alerts').send({ scanId: scan.body.id }).expect(404);
    await a.post('/api/alerts').send({ scanId: scan.body.id, contactId: foreign.body.id }).expect(404);
    assert.equal(sent.length, before);
    await a.post('/api/alerts').send({ scanId: scan.body.id, contactId: own.body.id }).expect(200);
    const message = sent.at(-1);
    assert.equal(message.to[0].email, 'trusted@example.com');
    for (const privateValue of ['123456', 'bkash-verify.example', 'token=secret', '/reset/private']) assert(!JSON.stringify(message).includes(privateValue), privateValue);
    failNext();
    await a.post('/api/alerts').send({ scanId: scan.body.id }).expect(503);
    const alerts = await a.get('/api/alerts').expect(200);
    assert.deepEqual(alerts.body.map((alert: any) => alert.status), ['sent', 'failed']);
    assert.equal((await b.get('/api/alerts').expect(200)).body.length, 0);
    await a.delete('/api/scans/' + scan.body.id).expect(200);
    await a.delete('/api/contacts/' + own.body.id).expect(200);
    const remaining = await a.get('/api/alerts').expect(200);
    assert(remaining.body.every((alert: any) => alert.scanId === null));
    assert.equal(remaining.body[0].contactId, null);
  });
});

test('admin category/brand moderation changes future scans and the graph stays private', async () => {
  const store = new MemoryStore(), app = createApp(store), admin = request.agent(app), a = request.agent(app), b = request.agent(app);
  await admin.post('/api/auth/register').send({ ...credentials, email: 'accept-admin@example.com' }).expect(201);
  await a.post('/api/auth/register').send(credentials).expect(201);
  await b.post('/api/auth/register').send({ ...credentials, email: 'accept-b@example.com' }).expect(201);
  const moderator = (await store.list('users', { email: 'accept-admin@example.com' }))[0];
  await store.update('users', moderator.id, { role: 'admin' });
  await admin.post('/api/admin/threatCategories').send({ name: 'Parcel Scam' }).expect(200);
  await admin.post('/api/admin/threatCategories').send({ name: 'Parcel Scam' }).expect(409);
  assert((await request(app).get('/api/categories').expect(200)).body.includes('Parcel Scam'));
  await a.post('/api/reports').send({ entity: 'https://evil.example', entityType: 'domain', category: 'Unknown Category', description: 'A suspicious request.' }).expect(400);
  const reports = [];
  for (const account of [a, b]) reports.push((await account.post('/api/reports').send({ entity: 'https://evil.example', entityType: 'domain', category: 'Parcel Scam', description: 'A suspicious parcel request.' }).expect(201)).body);
  for (const report of reports) await admin.patch('/api/admin/reports/' + report.id).send({ status: 'approved' }).expect(200);
  const matched = await request(app).post('/api/scans').send({ kind: 'url', text: 'https://evil.example' }).expect(200);
  assert(matched.body.evidence.some((entry: any) => entry.id === 'community'));
  await admin.patch('/api/admin/reports/' + reports[0].id).send({ status: 'rejected' }).expect(200);
  const rejected = await request(app).post('/api/scans').send({ kind: 'url', text: 'https://evil.example' }).expect(200);
  assert(!rejected.body.evidence.some((entry: any) => entry.id === 'community'));
  await admin.post('/api/admin/brands').send({ name: 'AcmePay', aliases: ['acmepay'], domains: ['https://acmepay.example/'] }).expect(200);
  const spoof = await request(app).post('/api/scans').send({ kind: 'url', text: 'https://acmepay-login.example' }).expect(200);
  assert(spoof.body.evidence.some((entry: any) => entry.title === 'Possible AcmePay impersonation'));
  const official = await request(app).post('/api/scans').send({ kind: 'url', text: 'https://help.acmepay.example' }).expect(200);
  assert(!official.body.evidence.some((entry: any) => entry.title === 'Possible AcmePay impersonation'));
  const graph = await a.get('/api/graph').expect(200);
  assert.equal(graph.body.edges.length, 1);
  assert.equal((await admin.get('/api/graph').expect(200)).body.edges.length, 0);
  assert((await admin.get('/api/admin/adminLogs').expect(200)).body.length >= 5);
  await a.get('/api/admin/adminLogs').expect(403);
});

test('image privacy options reject malformed or repeated values and save=false stays ephemeral', async () => {
  const store = new MemoryStore(), app = createApp(store), account = request.agent(app);
  await account.post('/api/auth/register').send(credentials).expect(201);
  const image = await QRCode.toBuffer('https://example.com/private?token=secret', { width: 400 });
  for (const invalid of ['False', 'off', '0'])
    await account.post('/api/scans/image').field('kind', 'qr').field('save', invalid).attach('image', image, 'qr.png').expect(400);
  await account.post('/api/scans/image').field('kind', 'qr').field('save', 'false').field('save', 'true').attach('image', image, 'qr.png').expect(400);
  const scan = await account.post('/api/scans/image').field('kind', 'qr').field('save', 'false').attach('image', image, 'qr.png').expect(200);
  assert.equal(scan.body.persisted, false);
  assert.equal(scan.body.extractedText, 'https://example.com/private?token=secret');
  assert.deepEqual((await account.get('/api/scans').expect(200)).body, []);
  await account.post('/api/scans/image').field('kind', 'qr').expect(400);
});

test('competing reset links cannot both replace credentials after reading the same password version', async () => {
  const store = new MemoryStore(), app = createApp(store);
  const user = await store.insert('users', { email: credentials.email, name: credentials.name, passwordHash: await passwordHash(credentials.password) });
  const values = [token(), token()];
  for (const value of values) await store.insert('authTokens', { userId: user.id, tokenHash: hash(value), purpose: resetTokenPurpose(user.passwordHash), expiresAt: new Date(Date.now() + 60000) });
  let pending = 0, release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }), list = store.list.bind(store);
  store.list = async (table, where) => {
    const rows = await list(table, where);
    if (table === 'users' && where?.id === user.id) { pending++; if (pending === 2) release(); await gate; }
    return rows;
  };
  const responses = await Promise.all(values.map((value, index) => request(app).post('/api/auth/confirm').send({ token: value, purpose: 'reset', password: `Replacement passphrase ${index} 12345` })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.match(responses.find((response) => response.status === 409)!.body.error, /credentials changed/);
});

test('administrator revocation cannot overwrite a password reset that wins the race', async () => {
  const store = new MemoryStore(), app = createApp(store), admin = request.agent(app);
  await admin.post('/api/auth/register').send({ ...credentials, email: 'race-admin@example.com' }).expect(201);
  const moderator = (await store.list('users', { email: 'race-admin@example.com' }))[0];
  await store.update('users', moderator.id, { role: 'admin' });
  const user = await store.insert('users', { email: credentials.email, name: credentials.name, disabled: false, passwordHash: await passwordHash(credentials.password) });
  const replacement = await passwordHash('Newer secure password 456');
  const update = store.updateUserIfPasswordMatches.bind(store);
  let changed = false;
  store.updateUserIfPasswordMatches = async (id, digest, changes) => {
    if (id === user.id && !changed) { changed = true; await store.update('users', id, { passwordHash: replacement }); }
    return update(id, digest, changes);
  };
  await admin.patch('/api/admin/users/' + user.id).send({ disabled: true }).expect(200);
  const final = (await store.list('users', { id: user.id }))[0];
  assert.equal(final.disabled, true);
  assert(await verifyPassword('Newer secure password 456', final.passwordHash));
  assert(!await verifyPassword(credentials.password, final.passwordHash));
});

test('a late reset-link issue cannot resurrect a link invalidated by a completed password reset', async () => {
  await mailFixture(async (sent) => {
    const store = new MemoryStore(), app = createApp(store), account = request.agent(app);
    await account.post('/api/auth/register').send(credentials).expect(201);
    const user = (await store.list('users', { email: credentials.email }))[0], first = token();
    await store.insert('authTokens', { userId: user.id, tokenHash: hash(first), purpose: resetTokenPurpose(user.passwordHash), expiresAt: new Date(Date.now() + 60000) });
    const insert = store.insert.bind(store);
    let ready!: () => void, release!: () => void;
    const waiting = new Promise<void>((resolve) => { ready = resolve; }), gate = new Promise<void>((resolve) => { release = resolve; });
    store.insert = async (table, row) => {
      if (table === 'authTokens' && row.purpose.startsWith('reset')) { ready(); await gate; }
      return insert(table, row);
    };
    const forgotten = account.post('/api/auth/forgot').send({ email: credentials.email }).then((result) => result);
    await waiting;
    await request(app).post('/api/auth/confirm').send({ token: first, purpose: 'reset', password: 'Replacement secure password 456' }).expect(200);
    release();
    assert.equal((await forgotten).status, 200);
    const late = mailToken(sent.at(-1));
    await request(app).post('/api/auth/confirm').send({ token: late, purpose: 'reset', password: 'Stale replacement password 789' }).expect(400);
    assert(await verifyPassword('Replacement secure password 456', (await store.list('users', { id: user.id }))[0].passwordHash));
  });
});

test('concurrent contact additions cannot exceed the ten-contact limit', async () => {
  const store = new MemoryStore(), app = createApp(store), account = request.agent(app);
  await account.post('/api/auth/register').send(credentials).expect(201);
  const user = (await store.list('users', { email: credentials.email }))[0];
  for (let index = 0; index < 9; index++) await store.insert('contacts', { userId: user.id, name: 'Existing contact', email: `existing${index}@example.com` });
  const list = store.list.bind(store);
  let reads = 0, release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  store.list = async (table, where) => {
    const rows = await list(table, where);
    if (table === 'contacts') { reads++; if (reads === 2) release(); await gate; }
    return rows;
  };
  const results = await Promise.all([0, 1].map((index) => account.post('/api/contacts').send({ name: 'New contact', email: `new${index}@example.com` })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 400]);
  assert.equal((await list('contacts', { userId: user.id })).length, 10);
});

test('legacy unbound reset links require a new request without changing the password', async () => {
  const store = new MemoryStore(), app = createApp(store);
  const user = await store.insert('users', {
    email: credentials.email, name: credentials.name, passwordHash: await passwordHash(credentials.password),
  }), legacy = token();
  await store.insert('authTokens', {
    userId: user.id, tokenHash: hash(legacy), purpose: 'reset', expiresAt: new Date(Date.now() + 60000),
  });
  const response = await request(app).post('/api/auth/confirm')
    .send({ token: legacy, purpose: 'reset', password: 'Replacement secure password 456' }).expect(400);
  assert.match(response.body.error, /Request a new link/);
  assert.equal((await store.list('users', { id: user.id }))[0].passwordHash, user.passwordHash);
});
