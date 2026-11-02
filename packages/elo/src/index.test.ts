import { describe, expect, it } from 'vitest';
import { INITIAL_ELO, calculateElo, expectedScore, kFactor } from './index';

describe('elo', () => {
  it('gleich starke Spieler haben 50 % Erwartung', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it('Neulinge haben K=40, erfahrene K=20', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(29)).toBe(40);
    expect(kFactor(30)).toBe(20);
  });

  it('Sieg zwischen gleich starken Neulingen: +20 / -20', () => {
    const p = { rating: INITIAL_ELO, matchesPlayed: 0 };
    expect(calculateElo(p, p, 1)).toEqual({ a: 1220, b: 1180 });
  });

  it('Remis zwischen gleich starken Spielern ändert nichts', () => {
    const p = { rating: 1500, matchesPlayed: 50 };
    expect(calculateElo(p, p, 0.5)).toEqual({ a: 1500, b: 1500 });
  });

  it('Außenseiter-Sieg bringt mehr Punkte als Favoriten-Sieg', () => {
    const underdog = { rating: 1000, matchesPlayed: 50 };
    const favorite = { rating: 1400, matchesPlayed: 50 };
    const upset = calculateElo(underdog, favorite, 1).a - underdog.rating;
    const expected = calculateElo(favorite, underdog, 1).a - favorite.rating;
    expect(upset).toBeGreaterThan(expected);
  });
});
