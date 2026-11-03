import { findUserById } from '@kata-clash/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth, signOut } from '@/auth';

export const metadata: Metadata = { title: 'Profil – Kata Clash' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await findUserById(session.user.id);
  if (!user) redirect('/login');

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <div className="profile">
      <div className="profile-head">
        <div>
          <h1>{user.name ?? 'Ohne Namen'}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="ghost-button">
            Abmelden
          </button>
        </form>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Elo</span>
          <span className="stat-value">{user.elo}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Siege</span>
          <span className="stat-value">{user.wins}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Niederlagen</span>
          <span className="stat-value">{user.losses}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Remis</span>
          <span className="stat-value">{user.draws}</span>
        </div>
      </div>

      <p className="muted">
        Mitglied seit{' '}
        {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(user.createdAt)}
      </p>
    </div>
  );
}
