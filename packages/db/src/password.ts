import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const ALGORITHM = 'scrypt';
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Format: `scrypt$<salt base64>$<hash base64>` – ohne externe Abhängigkeit. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(password, salt, KEY_BYTES)) as Buffer;
  return `${ALGORITHM}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltPart, hashPart] = stored.split('$');
  if (algorithm !== ALGORITHM || !saltPart || !hashPart) return false;

  const expected = Buffer.from(hashPart, 'base64');
  if (expected.length === 0) return false;

  const derived = (await scrypt(
    password,
    Buffer.from(saltPart, 'base64'),
    expected.length,
  )) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
