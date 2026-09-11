import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localScan, normalizeUrl, extractPhones, extractUrls } from '../server/engine.js';
import { enrich } from '../server/providers.js';
test('official domain has no impersonation signal', () => {
  const r = localScan('https://www.bkash.com/', 'url');
  assert.equal(r.score, 0);
  assert.equal(r.level, 'Low Risk');
  assert.match(r.explanation, /does not establish/);
});
test('brand embedded in untrusted hostname is detected', () => {
  const r = localScan('https://bkash.com.attacker.example/', 'url');
  assert(r.evidence.some((e) => e.id === 'brand:bkash'));
});
test('userinfo destination is parsed correctly', () => {
  const r = localScan('https://bkash.com@evil.example/login', 'url');
  assert(r.evidence.some((e) => e.id === 'userinfo'));
  assert.equal(new URL(r.urls[0]).hostname, 'evil.example');
});
test('Banglish and Bangla request patterns', () => {
  for (const text of [
    'Apnar bKash account bondho! Ekhoni https://bkash-verify.example e PIN din.',
    'অভিনন্দন! আপনি লটারি জিতেছেন। এখনই টাকা পাঠান এবং OTP দিন।',
  ])
    assert(localScan(text, 'message').score >= 50);
});
test('ordinary message is low risk', () =>
  assert.equal(localScan('আজ বিকেলে লাইব্রেরিতে দেখা হবে।', 'message').score, 0));
test('safety advice is not mistaken for a credential request', () =>
  assert(
    !localScan('Never share your OTP or PIN.', 'message').evidence.some(
      (e) => e.id === 'credentials',
    ),
  ));
test('reject unsafe schemes and malformed URLs', () => {
  for (const s of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,test',
    'https://bad domain.example',
  ])
    assert.throws(() => normalizeUrl(s));
});
test('HTTPS does not erase risky message evidence', () =>
  assert(
    localScan('Enter your password immediately at https://paypal-check.example/login', 'message')
      .score >= 50,
  ));
test('risk never exceeds 100 and evidence deduplicates', () => {
  const r = localScan(
    'Enter OTP immediately at https://bkash-verify.example '.repeat(8),
    'message',
  );
  assert(r.score <= 100);
  assert.equal(r.evidence.filter((e) => e.id === 'brand:bkash').length, 1);
});
test('URL extraction trims Bengali punctuation', () =>
  assert.equal(extractUrls('দেখুন https://example.com।')[0], 'https://example.com'));
test('Bangla phone digits normalize', () =>
  assert.deepEqual(extractPhones('ফোন ০১৭১২৩৪৫৬৭৮'), ['+8801712345678']));
test('provider absence is explicit', async () => {
  const r = await enrich(localScan('https://example.com', 'url'), 'https://example.com', true);
  assert(r.checks.some((c) => c.status === 'unavailable'));
  assert.equal(r.score, 0);
});
test('common Cyrillic look-alike characters are detected', () => {
  const r = localScan('https://раураl.com', 'url');
  assert(r.evidence.some((e) => e.id === 'unicode'));
  assert(r.evidence.some((e) => e.id === 'brand:paypal'));
});

test('ordinary word fragments do not trigger scam evidence', () => {
  assert.equal(localScan('Have a wonderful dinner. Your PIN stays private.', 'message').score, 0);
});
test('safety advice cannot hide a later credential request', () => {
  assert(localScan('Never share your OTP. However send your OTP to us.', 'message').evidence.some(e => e.id === 'credentials'));
});
test('scheme-less domains accept ports and malformed hosts fail', () => {
  assert.equal(normalizeUrl('example.com:8443/login').port, '8443');
  for (const value of ['https://-bad.example', 'https://bad..example', 'https://bad_.example']) assert.throws(() => normalizeUrl(value));
});
