'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (!result || result.error) {
        setError('E-Mail oder Passwort ist falsch.');
        return;
      }
      router.push('/profil');
      router.refresh();
    } catch {
      setError('Anmeldung fehlgeschlagen. Ist die Datenbank erreichbar?');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>E-Mail</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Passwort</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="run-button" disabled={pending}>
        {pending ? 'Anmelden …' : 'Anmelden'}
      </button>
    </form>
  );
}
