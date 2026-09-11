import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('hex');
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + ((await derive(password, salt, 64)) as Buffer).toString('hex');
}
export async function verifyPassword(password: string, stored: string) {
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
