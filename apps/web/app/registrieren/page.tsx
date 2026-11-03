import type { Metadata } from 'next';
import Link from 'next/link';

import { RegisterForm } from '@/components/register-form';

export const metadata: Metadata = { title: 'Registrieren – Kata Clash' };

export default function RegisterPage() {
  return (
    <section className="auth-card">
      <h1>Registrieren</h1>
      <p className="lede">
        Ein Konto speichert deine Elo-Zahl und deine Duelle. Mindestens 8 Zeichen fürs Passwort.
      </p>
      <RegisterForm />
      <p className="auth-switch">
        Schon dabei? <Link href="/login">Zur Anmeldung</Link>
      </p>
    </section>
  );
}
