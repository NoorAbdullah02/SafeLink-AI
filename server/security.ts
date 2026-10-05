import { scrypt, randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('hex');
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
// Bind reset links to the same credential/revocation version as sessions.
export const resetTokenPurpose = (passwordDigest: string) => 'reset:' + hash(passwordDigest);
export function sessionToken(passwordDigest: string): string {
  const random = token();
  const binding = createHmac('sha256', passwordDigest).update(random).digest('hex');
  return random + '.' + binding;
}
export function validSessionToken(value: string, passwordDigest: string): boolean {
  if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/i.test(value) || !validPasswordDigest(passwordDigest)) return false;
  const [random, binding] = value.split('.');
  const expected = createHmac('sha256', passwordDigest).update(random).digest();
  return timingSafeEqual(expected, Buffer.from(binding, 'hex'));
}
export function rotateSessionVersion(passwordDigest: string): string {
  // The optional third component changes session binding without changing the
  // scrypt salt/digest used to verify the password. No database migration needed.
  return passwordDigest.split(':').slice(0, 2).join(':') + ':' + token();
}
const validPasswordDigest = (stored: string) => typeof stored === 'string' && /^[a-f0-9]{32}:[a-f0-9]{128}(?::[a-f0-9]{64})?$/i.test(stored);
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + ((await derive(password, salt, 64)) as Buffer).toString('hex');
}
export async function verifyPassword(password: string, stored: string) {
  if (!validPasswordDigest(stored)) return false;
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const publicUser = (u: Record<string, any>) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  verified: u.verified,
  simpleMode: u.simpleMode,
});
