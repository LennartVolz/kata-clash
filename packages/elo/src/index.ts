export const INITIAL_ELO = 1200;

/** Ergebnis aus Sicht von Spieler A: 1 = Sieg, 0.5 = Remis, 0 = Niederlage. */
export type Score = 0 | 0.5 | 1;

/** K-Faktor: höher für Neulinge, damit sich das Rating schneller einpendelt. */
export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < 30 ? 40 : 20;
}

/** Erwartete Siegwahrscheinlichkeit von A gegen B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export interface EloPlayer {
  rating: number;
  matchesPlayed: number;
}

export interface EloResult {
  a: number;
  b: number;
}

/** Berechnet die neuen Ratings beider Spieler (auf ganze Zahlen gerundet). */
export function calculateElo(a: EloPlayer, b: EloPlayer, scoreA: Score): EloResult {
  const scoreB = (1 - scoreA) as Score;
  const newA = a.rating + kFactor(a.matchesPlayed) * (scoreA - expectedScore(a.rating, b.rating));
  const newB = b.rating + kFactor(b.matchesPlayed) * (scoreB - expectedScore(b.rating, a.rating));
  return { a: Math.round(newA), b: Math.round(newB) };
}
