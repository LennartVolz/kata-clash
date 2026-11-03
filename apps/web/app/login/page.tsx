import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = { title: 'Anmelden – Kata Clash' };

export default function LoginPage() {
  return (
    <section className="auth-card">
      <h1>Anmelden</h1>
      <p className="lede">Melde dich mit E-Mail und Passwort an, um dein Profil zu sehen.</p>
      <LoginForm />
      <p className="auth-switch">
        Noch kein Konto? <Link href="/registrieren">Jetzt registrieren</Link>
      </p>
    </section>
  );
}
