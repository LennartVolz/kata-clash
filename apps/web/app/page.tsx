import Link from 'next/link';

import { getKatas } from '@/lib/api';
import { DIFFICULTY_LABELS } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function KataListPage() {
  let katas;
  try {
    katas = await getKatas();
  } catch {
    return (
      <section className="notice">
        <h1>Kata-Katalog nicht erreichbar</h1>
        <p>
          Die API antwortet nicht. Starte sie mit <code>pnpm dev:server</code> und lade diese Seite
          neu.
        </p>
      </section>
    );
  }

  return (
    <>
      <h1>Solo-Training</h1>
      <p className="lede">
        Wähle eine Kata, schreibe deine Lösung und führe die sichtbaren Tests aus. Versteckte Tests
        entscheiden später im Duell.
      </p>
      <div className="kata-grid">
        {katas.map((kata) => (
          <Link key={kata.slug} className="kata-card" href={`/katas/${kata.slug}`}>
            <div className="kata-card-head">
              <h2>{kata.title}</h2>
              <span className={`badge badge-${kata.difficulty}`}>
                {DIFFICULTY_LABELS[kata.difficulty]}
              </span>
            </div>
            <p className="kata-meta">
              {kata.visibleTests} sichtbare Tests · {Math.round(kata.timeLimitSec / 60)} min
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
