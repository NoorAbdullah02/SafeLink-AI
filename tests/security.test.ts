import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash, verifyPassword, sessionToken, validSessionToken, rotateSessionVersion } from '../server/security.js';

test('revocation versions preserve passwords while invalidating previously issued tokens', async () => {
  const digest = await passwordHash('A secure test passphrase 123');
  const value = sessionToken(digest), rotated = rotateSessionVersion(digest);
  assert(validSessionToken(value, digest));
  assert(!validSessionToken(value, rotated));
  assert(await verifyPassword('A secure test passphrase 123', rotated));
  assert(!await verifyPassword('A wrong password', rotated));
  assert(!await verifyPassword('A secure test passphrase 123', rotated + ':unexpected'));
  assert(!validSessionToken(value, 'invalid-digest'));
  assert(!validSessionToken(value.slice(0, -1) + (value.endsWith('0') ? '1' : '0'), digest));
});
