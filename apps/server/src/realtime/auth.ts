import { decode } from '@auth/core/jwt';

/** Auth.js v5 nutzt diese Session-Cookies (mit und ohne Secure-Präfix). */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

export interface SessionUser {
  id: string;
}

export type SessionResolver = (cookieHeader: string | undefined) => Promise<SessionUser | null>;

/** Liest einen Cookie-Wert aus dem Handshake-Header, ohne Zusatzabhängigkeit. */
export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

/**
 * Prüft das Auth.js-JWT aus dem Socket-Handshake. Der Browser schickt das
 * HttpOnly-Cookie automatisch mit, wenn der Client `withCredentials` nutzt.
 * Das Cookie ist gleichzeitig der Salt des Tokens.
 */
export function createSessionResolver(secret: string): SessionResolver {
  return async (cookieHeader) => {
    for (const cookieName of SESSION_COOKIES) {
      const token = readCookie(cookieHeader, cookieName);
      if (!token) continue;
      try {
        const payload = await decode({ token, secret, salt: cookieName });
        const id =
          typeof payload?.id === 'string'
            ? payload.id
            : typeof payload?.sub === 'string'
              ? payload.sub
              : null;
        if (id) return { id };
      } catch {
        // Ungültiges oder abgelaufenes Token: nächsten Cookie-Namen versuchen.
      }
    }
    return null;
  };
}
