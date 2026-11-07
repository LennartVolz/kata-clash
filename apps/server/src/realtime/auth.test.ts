import { encode } from '@auth/core/jwt';
import { describe, expect, it } from 'vitest';

import { createSessionResolver, readCookie } from './auth';

const SECRET = 'handshake-test-secret-mit-mindestens-32-zeichen';

describe('Socket-Handshake-Auth', () => {
  it('liest einen Cookie-Wert aus mehreren Einträgen', () => {
    expect(readCookie('theme=dark; authjs.session-token=abc', 'authjs.session-token')).toBe('abc');
    expect(readCookie('theme=dark', 'authjs.session-token')).toBeUndefined();
    expect(readCookie(undefined, 'authjs.session-token')).toBeUndefined();
  });

  it('akzeptiert ein gültiges Auth.js-Session-Token', async () => {
    const token = await encode({
      token: { id: 'user-1', sub: 'user-1' },
      secret: SECRET,
      salt: 'authjs.session-token',
    });
    const resolve = createSessionResolver(SECRET);
    await expect(resolve(`theme=dark; authjs.session-token=${token}`)).resolves.toEqual({
      id: 'user-1',
    });
  });

  it('lehnt fehlende, manipulierte und fremd signierte Tokens ab', async () => {
    const resolve = createSessionResolver(SECRET);
    await expect(resolve(undefined)).resolves.toBeNull();
    await expect(resolve('authjs.session-token=kaputt')).resolves.toBeNull();

    const foreign = await encode({
      token: { id: 'user-1', sub: 'user-1' },
      secret: 'fremdes-secret-mit-mindestens-32-zeichen',
      salt: 'authjs.session-token',
    });
    await expect(resolve(`authjs.session-token=${foreign}`)).resolves.toBeNull();
  });
});
