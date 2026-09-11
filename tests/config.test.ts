import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins } from '../server/config.js';

test('production permits only the configured application origin', () => {
  const origins = allowedOrigins('https://safelink.example/path', true);
  assert.deepEqual([...origins], ['https://safelink.example']);
  assert(!origins.has('http://localhost:5174'));
});
