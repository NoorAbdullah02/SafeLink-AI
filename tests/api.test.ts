import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { MemoryStore } from '../server/store.js';
import { hash, token } from '../server/security.js';
test('accounts, private history, reports, authorization and logout work end to end', async () => {
  const store = new MemoryStore(),
    app = createApp(store),
    a = request.agent(app),
    b = request.agent(app);
  await a
    .post('/api/auth/register')
    .send({ name: 'Tester', email: 'test@example.com', password: 'a long passphrase 123' })
    .expect(201);
  await b
    .post('/api/auth/register')
    .send({ name: 'Other', email: 'other@example.com', password: 'a long passphrase 456' })
    .expect(201);
  const users = await store.list('users');
  assert(!users[0].password);
  assert(!users[0].passwordHash.includes('passphrase'));
  const scan = await a
    .post('/api/scans')
    .send({
      kind: 'message',
      text: 'Enter OTP immediately at https://bkash-verify.example/login?token=secret',
    })
    .expect(200);
  assert(scan.body.score >= 50);
  assert.equal(scan.body.persisted, true);
  const history = await a.get('/api/scans').expect(200);
  assert.equal(history.body.length, 1);
  assert(!JSON.stringify(history.body).includes('token=secret'));
  assert.equal((await b.get('/api/scans')).body.length, 0);
  await b.delete('/api/scans/' + scan.body.id).expect(404);
  await a
    .patch('/api/scans/' + scan.body.id)
    .send({ saved: true })
    .expect(200);
  await a.get('/api/admin/users').expect(403);
  const report = {
    entity: 'https://evil.example',
    entityType: 'domain',
    category: 'Phishing',
    description: 'Suspicious credential request',
  };
  await a.post('/api/reports').send(report).expect(201);
  await a.post('/api/reports').send(report).expect(409);
  await a
    .post('/api/scans')
    .set('Origin', 'https://evil.example')
    .send({ kind: 'url', text: 'https://example.com' })
    .expect(403);
  await a.post('/api/auth/logout').expect(200);
  await a.get('/api/me').expect(401);
});
test('only distinct approved reporters increase community risk', async () => {
  const store = new MemoryStore(),
    app = createApp(store);
  for (let i = 0; i < 2; i++)
    await store.insert('reports', { userId: 'u' + i, entity: 'evil.example', status: 'pending' });
  let r = await request(app).post('/api/scans').send({ kind: 'url', text: 'https://evil.example' });
  assert(!r.body.evidence.some((e: any) => e.id === 'community'));
  for (const row of await store.list('reports'))
    await store.update('reports', row.id, { status: 'approved' });
  r = await request(app).post('/api/scans').send({ kind: 'url', text: 'https://evil.example' });
  assert(r.body.evidence.some((e: any) => e.id === 'community'));
});
test('reset tokens expire and are single use', async () => {
  const store = new MemoryStore(),
    app = createApp(store);
  const user = await store.insert('users', { email: 'reset@example.com' }),
    t = token();
  await store.insert('authTokens', {
    userId: user.id,
    tokenHash: hash(t),
    purpose: 'reset',
    expiresAt: new Date(Date.now() + 100000),
  });
  await request(app)
    .post('/api/auth/confirm')
    .send({ token: t, purpose: 'reset', password: 'New secure password 123' })
    .expect(200);
  await request(app)
    .post('/api/auth/confirm')
    .send({ token: t, purpose: 'reset', password: 'Another password 456' })
    .expect(400);
});
test('unsafe upload is rejected without execution', async () => {
  await request(createApp(new MemoryStore()))
    .post('/api/scans/image')
    .field('kind', 'qr')
    .attach('image', Buffer.from('<script>alert(1)</script>'), 'bad.png')
    .expect(422);
});
test('database outage still allows a local scan with an existing session cookie', async () => {
  const store = new MemoryStore();
  store.list = async () => {
    throw new Error('Database down');
  };
  const response = await request(createApp(store))
    .post('/api/scans')
    .set('Cookie', 'safelink_session=existing-session')
    .send({ kind: 'message', text: 'Enter your OTP immediately.' })
    .expect(200);
  assert(response.body.score > 0);
  assert.equal(response.body.persisted, false);
  assert(
    response.body.checks.some(
      (c: any) => c.name === 'Account and history' && c.status === 'unavailable',
    ),
  );
});

test('malformed URLs return actionable validation errors', async () => {
  const app = createApp(new MemoryStore());
  for(const text of ['javascript:alert(1)', 'https://bad..example', 'https://bad domain.example']) {
    const r = await request(app).post('/api/scans').send({kind:'url',text}).expect(400);
    assert(r.body.error);
  }
});
test('admin disabling revokes sessions permanently and missing targets return 404', async () => {
  const store = new MemoryStore(), app = createApp(store), admin = request.agent(app), member = request.agent(app);
  await admin.post('/api/auth/register').send({name:'Admin',email:'audit-admin@example.com',password:'Strong audit password 123'}).expect(201);
  await member.post('/api/auth/register').send({name:'Member',email:'audit-member@example.com',password:'Strong audit password 456'}).expect(201);
  const users = await store.list('users');
  const a = users.find(u=>u.email==='audit-admin@example.com')!, m=users.find(u=>u.email==='audit-member@example.com')!;
  await store.update('users',a.id,{role:'admin'});
  await admin.patch('/api/admin/users/'+m.id).send({disabled:true}).expect(200);
  await admin.patch('/api/admin/users/'+m.id).send({disabled:false}).expect(200);
  await member.get('/api/me').expect(401);
  await admin.patch('/api/admin/users/11111111-1111-4111-8111-111111111111').send({disabled:true}).expect(404);
  await admin.patch('/api/admin/reports/11111111-1111-4111-8111-111111111111').send({status:'approved'}).expect(404);
});

// Origin regression: local previews work, untrusted websites stay blocked.
test('development preview origins pass CORS and write-request validation', async () => {
  const app = createApp(new MemoryStore());
  for (const origin of ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5174']) {
    const result = await request(app).post('/api/scans').set('Origin', origin).send({kind:'url',text:'https://example.com'}).expect(200);
    assert.equal(result.headers['access-control-allow-origin'], origin);
  }
  for (const origin of ['https://evil.example','http://localhost.evil.example:5174','null']) {
    await request(app).post('/api/scans').set('Origin', origin).send({kind:'url',text:'https://example.com'}).expect(403);
  }
});

test('profile, trusted contacts and verification gates preserve account isolation', async () => {
  const store = new MemoryStore(), app = createApp(store), a=request.agent(app), b=request.agent(app);
  await a.post('/api/auth/register').send({name:'Family QA',email:'familyqa@example.com',password:'A local QA password 123'}).expect(201);
  await b.post('/api/auth/register').send({name:'Other QA',email:'otherqa@example.com',password:'Another local QA password 123'}).expect(201);
  await a.patch('/api/me').send({name:'Updated QA',simpleMode:true}).expect(200);
  const profile=await a.get('/api/me').expect(200);
  assert.equal(profile.body.simpleMode,true); assert.equal(profile.body.name,'Updated QA');
  const contact=await a.post('/api/contacts').send({name:'Test contact',email:'contact@example.com'}).expect(201);
  assert.equal((await a.get('/api/contacts')).body.length,1);
  assert.equal((await b.get('/api/contacts')).body.length,0);
  await b.delete('/api/contacts/'+contact.body.id).expect(404);
  await a.post('/api/alerts').send({scanId:'11111111-1111-4111-8111-111111111111',contactId:contact.body.id}).expect(403);
  assert.equal((await a.get('/api/alerts')).body.length,0);
  await a.delete('/api/contacts/'+contact.body.id).expect(200);
  assert.equal((await a.get('/api/contacts')).body.length,0);
  await a.post('/api/auth/logout').expect(200);
  await a.post('/api/auth/login').send({email:'familyqa@example.com',password:'incorrect password'}).expect(401);
  await a.post('/api/auth/login').send({email:'familyqa@example.com',password:'A local QA password 123'}).expect(200);
});
