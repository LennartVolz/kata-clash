import { describe, expect, it } from 'vitest';

import { KATAS, findKata, listKataSummaries, toKataDetail } from './index';

describe('Kata-Bibliothek', () => {
  it('enthält 5 bis 10 Katas mit eindeutigen Slugs', () => {
    expect(KATAS.length).toBeGreaterThanOrEqual(5);
    expect(KATAS.length).toBeLessThanOrEqual(10);
    expect(new Set(KATAS.map((kata) => kata.slug)).size).toBe(KATAS.length);
  });

  it('gibt jeder Kata sichtbare und versteckte Tests', () => {
    for (const kata of KATAS) {
      expect(kata.tests.filter((test) => !test.hidden).length).toBeGreaterThan(0);
      expect(kata.tests.filter((test) => test.hidden).length).toBeGreaterThan(0);
    }
  });

  it('liefert im Detail nur sichtbare Tests und Starter-Code für beide Sprachen', () => {
    const detail = toKataDetail(KATAS[0]!);
    expect(detail.tests).toHaveLength(detail.visibleTests);
    expect(detail.tests.every((test) => !('hidden' in test))).toBe(true);
    expect(detail.starterCode.javascript.length).toBeGreaterThan(0);
    expect(detail.starterCode.python.length).toBeGreaterThan(0);
    expect(detail.totalTests).toBeGreaterThan(detail.visibleTests);
  });

  it('findet Katas über den Slug', () => {
    expect(findKata('summe-bis-n')?.title).toBe('Summe bis n');
    expect(findKata('gibt-es-nicht')).toBeUndefined();
  });

  it('fasst alle Katas für den Katalog zusammen', () => {
    const summaries = listKataSummaries();
    expect(summaries).toHaveLength(KATAS.length);
    expect(summaries[0]).not.toHaveProperty('description');
  });
});
