import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('Passwort-Hashing', () => {
  it('akzeptiert das richtige Passwort', async () => {
    const stored = await hashPassword('geheim123');
    expect(await verifyPassword('geheim123', stored)).toBe(true);
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const stored = await hashPassword('geheim123');
    expect(await verifyPassword('geheim124', stored)).toBe(false);
  });

  it('erzeugt für dasselbe Passwort unterschiedliche Hashes', async () => {
    const first = await hashPassword('geheim123');
    const second = await hashPassword('geheim123');
    expect(first).not.toBe(second);
    expect(first.startsWith('scrypt$')).toBe(true);
  });

  it('lehnt kaputte Hashes ab, statt zu werfen', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'md5$abc$def')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$')).toBe(false);
  });
});
