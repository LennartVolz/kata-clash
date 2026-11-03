import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Kata Clash – Solo-Training',
  description: 'Kleine Programmieraufgaben im Browser lösen – JavaScript und Python.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            ⚔️ Kata Clash
          </Link>
          <span className="tagline">Solo-Training</span>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
