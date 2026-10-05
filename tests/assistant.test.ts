import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askCyberAssistant, getCyberExpertResponse } from '../server/assistant.js';
import { sanitizeExternalText, privateHistoryResult } from '../server/privacy.js';
import { localScan } from '../server/engine.js';

test('assistant stays local without external opt-in even when a provider is configured', async () => {
  const previous = process.env.LLM_API_KEY, previousFetch = globalThis.fetch;
  process.env.LLM_API_KEY = 'test-key';
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Should not be contacted'); };
  try {
    const result = await askCyberAssistant('I shared my PIN');
    assert.equal(result.source, 'local');
    assert.equal(result.externalUsed, false);
    assert.equal(requests, 0);
  } finally { process.env.LLM_API_KEY = previous; globalThis.fetch = previousFetch; }
});

test('incident advice does not promise recovery or mislabel the women support line', () => {
  const money = getCyberExpertResponse('I lost money to a bKash scam');
  assert.match(money.reply, /Recovery is not guaranteed/);
  const pin = getCyberExpertResponse('I shared my PIN');
  assert.match(pin.reply, /do not rely on deliberately entering a wrong PIN/);
  const contacts = getCyberExpertResponse('helpline');
  assert.equal(contacts.hotlines.find((contact) => contact.number === '01320000888')?.name, 'Police Cyber Support for Women');
  assert(contacts.hotlines.every((contact) => contact.source?.startsWith('https://')));
  assert(!JSON.stringify(contacts).includes('CID'));
  assert(!getCyberExpertResponse('জিডি কীভাবে করব?').reply.includes('সঠিক আইনি ধারাসহ'));
});

test('the Bangla lost-money preset returns transaction incident guidance', () => {
  for (const question of ['টাকা খোয়া গেলে দ্রুত কী করব?', 'আমার টাকা খোয়া গেছে', 'টাকা হারিয়ে ফেলেছি']) {
    const result = getCyberExpertResponse(question);
    assert.match(result.reply, /লেনদেনের ID/);
    assert.match(result.reply, /টাকা ফেরত পাওয়া নিশ্চিত নয়/);
    assert(result.hotlines.some((contact) => contact.number === '16247'));
  }
});

test('external redaction removes URL paths, emails, Bengali digits and labelled credentials', () => {
  const result = sanitizeExternalText('Email me@example.com OTP ১২৩৪৫৬ password: secretword https://example.com/private-path?token=secret and bkash-login.io/reset/private-code');
  for (const secret of ['me@example.com', '১২৩৪৫৬', 'secretword', 'private-path', 'token=secret', 'private-code']) assert(!result.includes(secret), secret);
  assert(result.includes('https://example.com'));
});

test('privacy redaction is idempotent and preserves generic credential evidence', () => {
  const generic = 'The message asks for an OTP, PIN or password.';
  assert.equal(sanitizeExternalText(generic), generic);
  assert.equal(sanitizeExternalText('Passwords and OTP protection matter.'), 'Passwords and OTP protection matter.');
  const once = sanitizeExternalText('My OTP ১২৩৪৫৬ and password: secretword; token=privateToken. Email me@example.com at https://example.com/private?secret=value');
  assert.equal(sanitizeExternalText(once), once);
  assert(!once.includes('secretword'));
  assert(!once.includes('privateToken'));
  for (const placeholder of ['[secret removed]', '[number removed]', '[email removed]', '[link removed]'])
    assert.equal(sanitizeExternalText('OTP ' + placeholder), 'OTP ' + placeholder);
  const scan = localScan('Send your OTP or PIN immediately.', 'message');
  const first = privateHistoryResult(scan), second = privateHistoryResult(first);
  assert.deepEqual(second, first);
  assert.equal(second.evidence.find((entry) => entry.id === 'credentials')?.detail, generic);
  first.evidence.find((entry) => entry.id === 'credentials')!.detail = 'The message asks for an OTP, PIN [secret removed] removed] password.';
  assert.equal(privateHistoryResult(first).evidence.find((entry) => entry.id === 'credentials')?.detail, generic);
});

test('assistant validates AI output and reports external submission when using a local fallback', async () => {
  const previous = process.env.LLM_API_KEY, previousFetch = globalThis.fetch;
  process.env.LLM_API_KEY = 'test-key';
  let sent = '';
  globalThis.fetch = async (_input, init) => {
    sent = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Enter 3 wrong PINs to guarantee your money is safe.' } }] }), { status: 200 });
  };
  try {
    const result = await askCyberAssistant('My OTP ১২৩৪৫৬ was stolen at https://example.com/reset/private?key=secret', [], true);
    assert.equal(result.source, 'local');
    assert.equal(result.externalUsed, true);
    assert(!sent.includes('১২৩৪৫৬'));
    assert(!sent.includes('key=secret'));
    assert(!sent.includes('/reset/private'));
  } finally { process.env.LLM_API_KEY = previous; globalThis.fetch = previousFetch; }
});

test('external redaction covers every URL beyond the local scan limit', () => {
  const text = Array.from({ length: 12 }, (_, index) => `https://site${index}.example/private-${index}?token=demo-${index}`).join(' ');
  assert.equal(localScan(text, 'message').urls.length, 10);
  const sanitized = sanitizeExternalText(text);
  assert(!sanitized.includes('/private-'), sanitized);
  assert(!sanitized.includes('demo-'), sanitized);
  assert(sanitized.includes('https://site11.example'));
  assert.equal(sanitizeExternalText(sanitized), sanitized);
  assert.equal(sanitizeExternalText('Open https://user:password@evil.example/private?key=value'), 'Open https://evil.example');
  assert.equal(sanitizeExternalText('Email নাম@support.example.com'), 'Email [email removed]');
});

test('English and Bangla labelled secrets redact punctuation and quoted spaces completely', () => {
  const text = 'My password: S3cr.et!value and পাসওয়ার্ড: গোপনশব্দ; পাসওয়ার্ড = আরেকগোপন। ওটিপি: ১২৩৪৫৬ পিন: 9876 token="two secret words!"';
  const sanitized = sanitizeExternalText(text);
  for (const value of ['S3cr', '.et!value', 'গোপনশব্দ', 'আরেকগোপন', '১২৩৪৫৬', '9876', 'two secret words']) assert(!sanitized.includes(value), sanitized);
  assert.equal(sanitizeExternalText(sanitized), sanitized);
  const advice = 'আপনার ওটিপি বা পিন কখনো কাউকে দেবেন না।';
  assert.equal(sanitizeExternalText(advice), advice);
});
