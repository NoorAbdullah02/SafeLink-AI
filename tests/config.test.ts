import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, readConfig } from '../server/config.js';

test('invalid configuration fails before serving requests', () => {
  for (const env of [
    { PORT: 'NaN' }, { RETENTION_DAYS: 'not-a-day' }, { TRUST_PROXY_HOPS: '-1' },
    { APP_URL: 'javascript:alert(1)' }, { APP_URL: 'https://user:secret@example.com' },
    { NODE_ENV: 'production', APP_URL: 'http://example.com' },
    { NODE_ENV: 'production', APP_URL: 'https://example.com', DEMO_MEMORY: 'true' },
  ]) assert.throws(() => readConfig(env));
  assert.equal(readConfig({ NODE_ENV: 'production', APP_URL: 'https://example.com', TRUST_PROXY_HOPS: '1' }).trustProxyHops, 1);
});

test('production permits only the configured application origin', () => {
  const origins = allowedOrigins('https://safelink.example/path', true);
  assert.deepEqual([...origins], ['https://safelink.example']);
  assert(!origins.has('http://localhost:5174'));
});
