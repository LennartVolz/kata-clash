import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { auth } from '@/auth';

import './globals.css';

export const metadata: Metadata = {
  title: 'Kata Clash – Solo-Training',
  description: 'Kleine Programmieraufgaben im Browser lösen – JavaScript und Python.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="de">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            ⚔️ Kata Clash
          </Link>
          <span className="tagline">Solo-Training</span>
          <nav className="site-nav">
            {session?.user ? (
              <Link href="/profil">{session.user.name ?? 'Profil'}</Link>
            ) : (
              <Link href="/login">Anmelden</Link>
            )}
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
