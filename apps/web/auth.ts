import { PrismaAdapter } from '@auth/prisma-adapter';
import { findUserByEmail, prisma, verifyPassword } from '@kata-clash/db';
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const providers: NextAuthConfig['providers'] = [
  Credentials({
    name: 'E-Mail und Passwort',
    credentials: {
      email: { label: 'E-Mail', type: 'email' },
      password: { label: 'Passwort', type: 'password' },
    },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;

      const user = await findUserByEmail(parsed.data.email);
      if (!user?.passwordHash) return null;
      if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

// GitHub ist optional: ohne Zugangsdaten bleibt nur der Login per Passwort aktiv.
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Der Adapter erwartet den Client aus `@prisma/client`; die generierte Variante
  // aus packages/db ist strukturell identisch, aber ein eigener Typ.
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
