import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localScan } from '../server/engine.js';
import { enrich } from '../server/providers.js';
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
