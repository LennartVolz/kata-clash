'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        issues?: string[];
      } | null;

      if (!response.ok) {
        setError(body?.issues?.join(' ') || body?.error || 'Registrierung fehlgeschlagen.');
        return;
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (!result || result.error) {
        setError('Konto erstellt, aber die Anmeldung hat nicht geklappt. Bitte einloggen.');
        return;
      }
      router.push('/profil');
      router.refresh();
    } catch {
      setError('Registrierung fehlgeschlagen. Ist die Datenbank erreichbar?');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          name="name"
          autoComplete="nickname"
          minLength={2}
          maxLength={50}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
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
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="run-button" disabled={pending}>
        {pending ? 'Konto wird angelegt …' : 'Konto anlegen'}
      </button>
    </form>
  );
}
