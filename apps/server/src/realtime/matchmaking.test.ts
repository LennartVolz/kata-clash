import { describe, expect, it } from 'vitest';

import { eloRangeFor, findPairs, InMemoryMatchmakingQueue, type QueueEntry } from './matchmaking';

const OPTIONS = { eloRangeBase: 100, eloRangeGrowthPerSec: 50, eloRangeMax: 1000 };
const NOW = 1_700_000_000_000;

function entry(userId: string, elo: number, waitedSec = 0): QueueEntry {
  return { userId, elo, joinedAt: NOW - waitedSec * 1000 };
}

describe('Matchmaking', () => {
  it('paart Spieler innerhalb der Start-Toleranz', () => {
    const pairs = findPairs([entry('a', 1200), entry('b', 1290)], NOW, OPTIONS);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.map((player) => player.userId)).toEqual(['a', 'b']);
  });

  it('wartet bei zu großem Elo-Abstand, bis die Toleranz wächst', () => {
    const entries = [entry('a', 1200), entry('b', 1600)];
    expect(findPairs(entries, NOW, OPTIONS)).toHaveLength(0);
    // Nach 10 Sekunden Wartezeit: 100 + 10 × 50 = 600 Punkte Toleranz.
    expect(eloRangeFor(entries[0]!.joinedAt, NOW + 10_000, OPTIONS)).toBe(600);
    expect(findPairs(entries, NOW + 10_000, OPTIONS)).toHaveLength(1);
  });

  it('deckelt die Toleranz und paart ältere Einträge zuerst', () => {
    expect(eloRangeFor(NOW, NOW + 60_000, OPTIONS)).toBe(1000);
    const entries = [entry('neu', 1250, 1), entry('alt', 1200, 10), entry('mittel', 1210, 5)];
    const pairs = findPairs(entries, NOW, OPTIONS);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.map((player) => player.userId)).toEqual(['alt', 'mittel']);
  });

  it('claim entfernt beide Spieler atomar', async () => {
    const queue = new InMemoryMatchmakingQueue();
    await queue.join('javascript', { userId: 'a', elo: 1200 });
    await queue.join('javascript', { userId: 'b', elo: 1210 });

    expect(await queue.claim('javascript', 'a', 'b')).toBe(true);
    expect(await queue.entries('javascript')).toHaveLength(0);
    expect(await queue.claim('javascript', 'a', 'b')).toBe(false);
  });
});
