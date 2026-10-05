import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localScan } from '../server/engine.js';
import { enrich, aiSettings } from '../server/providers.js';
test('failed AI and threat services preserve deterministic evidence', async () => {
  const oldFetch = globalThis.fetch;
  const names = ['SAFE_BROWSING_API_KEY', 'LLM_API_KEY', 'LLM_MODEL'] as const;
  const previous = names.map((n) => process.env[n]);
  names.forEach((n) => (process.env[n] = 'test-only'));
  globalThis.fetch = async () => {
    throw new Error('Controlled outage');
  };
  try {
    const original = localScan('Enter OTP immediately at https://bkash-verify.example', 'message');
    const score = original.score;
    const r = await enrich(original, 'Controlled sample', true, {
      analyze: async () => {
        throw new Error('Controlled AI failure');
      },
    });
    assert.equal(r.score, score);
    assert.equal(r.aiExplanation, null);
    assert.equal(r.checks.filter((c) => c.status === 'unavailable').length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    names.forEach((n, i) => {
      if (previous[i] === undefined) delete process.env[n];
      else process.env[n] = previous[i];
    });
  }
});

test('successful provider contributions stay traceable and external checks require opt-in', async () => {
  const previousFetch = globalThis.fetch, previous = [process.env.SAFE_BROWSING_API_KEY, process.env.LLM_API_KEY];
  process.env.SAFE_BROWSING_API_KEY = 'mock-only'; process.env.LLM_API_KEY = 'mock-only';
  let requests = 0, aiCalls = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(JSON.stringify({ matches: [{ threatType: 'SOCIAL_ENGINEERING', threat: { url: 'https://evil.example/' } }] }), { status: 200 });
  };
  try {
    const ai = { analyze: async () => { aiCalls++; return { explanation: 'The content uses a pressure tactic; this interpretation can be wrong.', semanticRisk: 12 }; } };
    const skipped = await enrich(localScan('https://evil.example', 'url'), 'Controlled text', false, ai);
    assert.equal(requests, 0); assert.equal(aiCalls, 0); assert.equal(skipped.score, 0);
    const result = await enrich(localScan('https://evil.example', 'url'), 'Controlled text', true, ai);
    assert.equal(result.score, 92);
    assert(result.evidence.some((entry) => entry.source === 'intelligence' && entry.id === 'google-threat'));
    assert(result.evidence.some((entry) => entry.source === 'ai' && entry.weight === 12));
    assert.equal(result.checks.filter((check) => check.status === 'complete').length, 3);
  } finally {
    globalThis.fetch = previousFetch;
    [process.env.SAFE_BROWSING_API_KEY, process.env.LLM_API_KEY] = previous;
  }
});

test('an unrelated threat-list response cannot mark the submitted destination as a threat', async () => {
  const previousFetch = globalThis.fetch, previous = process.env.SAFE_BROWSING_API_KEY;
  process.env.SAFE_BROWSING_API_KEY = 'mock-only';
  globalThis.fetch = async () => new Response(JSON.stringify({ matches: [{ threatType: 'MALWARE', threat: { url: 'https://unrelated.example/' } }] }), { status: 200 });
  try {
    const result = await enrich(localScan('https://example.com', 'url'), 'Controlled text', true);
    assert.equal(result.score, 0);
    assert(!result.evidence.some((entry) => entry.id === 'google-threat'));
    assert(result.checks.some((check) => check.name === 'Threat intelligence' && check.status === 'unavailable'));
  } finally { globalThis.fetch = previousFetch; process.env.SAFE_BROWSING_API_KEY = previous; }
});

test('insecure AI endpoints are unavailable without contacting them', () => {
  const before = [process.env.LLM_API_KEY, process.env.LLM_BASE_URL];
  process.env.LLM_API_KEY = 'mock-only';
  try {
    for (const url of ['http://provider.example/v1', 'https://user:password@provider.example/v1', 'https://provider.example/v1?secret=value']) {
      process.env.LLM_BASE_URL = url;
      assert.equal(aiSettings(), undefined);
    }
  } finally { [process.env.LLM_API_KEY, process.env.LLM_BASE_URL] = before; }
});

test('threat-list evidence reports only the points needed to reach the score floor', async () => {
  const previousFetch = globalThis.fetch, previousKey = process.env.SAFE_BROWSING_API_KEY;
  process.env.SAFE_BROWSING_API_KEY = 'mock-only';
  globalThis.fetch = async () => new Response(JSON.stringify({ matches: [{ threatType: 'MALWARE', threat: { url: 'https://evil.example/' } }] }), { status: 200 });
  try {
    for (const startingScore of [30, 100]) {
      const scan = localScan('https://evil.example', 'url');
      scan.score = startingScore;
      const result = await enrich(scan, 'Controlled sample', true);
      const contribution = result.evidence.find((entry) => entry.id === 'google-threat')!.weight;
      assert.equal(contribution, Math.max(0, 80 - startingScore));
      assert.equal(result.score, startingScore + contribution);
    }
  } finally { globalThis.fetch = previousFetch; process.env.SAFE_BROWSING_API_KEY = previousKey; }
});
