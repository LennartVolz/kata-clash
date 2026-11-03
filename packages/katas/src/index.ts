import type { Kata, KataDetail, KataSummary } from '@kata-clash/shared';

import { fibonacci } from './fibonacci';
import { fizzbuzz } from './fizzbuzz';
import { maxSumme } from './max-summe';
import { palindrom } from './palindrom';
import { summeBisN } from './summe-bis-n';
import { textUmdrehen } from './text-umdrehen';
import { vokaleZaehlen } from './vokale-zaehlen';
import { zweiSummen } from './zwei-summen';

/**
 * Kata-Bibliothek (Phase 2). Jede Kata ist beim Import bereits gegen das Schema
 * validiert; ein Fehler in den Daten fällt damit sofort beim Start und in Tests auf.
 */
export const KATAS: Kata[] = [
  summeBisN,
  textUmdrehen,
  palindrom,
  fizzbuzz,
  vokaleZaehlen,
  fibonacci,
  maxSumme,
  zweiSummen,
];

const bySlug = new Map(KATAS.map((kata) => [kata.slug, kata]));

if (bySlug.size !== KATAS.length) {
  throw new Error('Kata-Slugs müssen eindeutig sein');
}

export function findKata(slug: string): Kata | undefined {
  return bySlug.get(slug);
}

export function listKataSummaries(): KataSummary[] {
  return KATAS.map(toKataSummary);
}

/** Ansicht ohne versteckte Tests – für den Kata-Katalog und die Detailseite. */
export function toKataDetail(kata: Kata): KataDetail {
  return {
    ...toKataSummary(kata),
    description: kata.description,
    functionName: kata.functionName,
    starterCode: {
      javascript: kata.starterCode.javascript,
      python: kata.starterCode.python,
    },
    tests: kata.tests
      .filter((test) => !test.hidden)
      .map((test) => ({
        id: test.id,
        name: test.name,
        args: test.args,
        expected: test.expected,
      })),
  };
}

function toKataSummary(kata: Kata): KataSummary {
  return {
    slug: kata.slug,
    title: kata.title,
    difficulty: kata.difficulty,
    timeLimitSec: kata.timeLimitSec,
    visibleTests: kata.tests.filter((test) => !test.hidden).length,
    totalTests: kata.tests.length,
  };
}
