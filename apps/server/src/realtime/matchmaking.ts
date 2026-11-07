import { LANGUAGES, type Language } from '@kata-clash/shared';

/** Ein Spieler in der Warteschlange; `joinedAt` ist ein Unix-Zeitstempel in Millisekunden. */
export interface QueueEntry {
  userId: string;
  elo: number;
  joinedAt: number;
}

/** Wie stark die Elo-Toleranz mit der Wartezeit wächst. */
export interface PairingOptions {
  eloRangeBase: number;
  eloRangeGrowthPerSec: number;
  eloRangeMax: number;
}

/** Erlaubte Elo-Differenz für einen Spieler, der seit `joinedAt` wartet. */
export function eloRangeFor(joinedAt: number, now: number, options: PairingOptions): number {
  const waitedSec = Math.max(0, Math.floor((now - joinedAt) / 1000));
  return Math.min(
    options.eloRangeMax,
    options.eloRangeBase + waitedSec * options.eloRangeGrowthPerSec,
  );
}

/**
 * Greedy-Pairing nach Wartezeit: ältere Einträge zuerst, damit niemand verhungert.
 * Maßgeblich ist die Toleranz des länger wartenden Spielers.
 */
export function findPairs(
  entries: QueueEntry[],
  now: number,
  options: PairingOptions,
): [QueueEntry, QueueEntry][] {
  const sorted = [...entries].sort(
    (a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId),
  );
  const used = new Set<string>();
  const pairs: [QueueEntry, QueueEntry][] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const first = sorted[i];
    if (!first || used.has(first.userId)) continue;
    const range = eloRangeFor(first.joinedAt, now, options);

    for (let j = i + 1; j < sorted.length; j += 1) {
      const second = sorted[j];
      if (!second || used.has(second.userId)) continue;
      if (Math.abs(first.elo - second.elo) > range) continue;
      used.add(first.userId);
      used.add(second.userId);
      pairs.push([first, second]);
      break;
    }
  }

  return pairs;
}

/** Ablage der Warteschlange; Redis im Betrieb, In-Memory in Tests. */
export interface MatchmakingQueue {
  join(language: Language, entry: { userId: string; elo: number }): Promise<void>;
  leave(language: Language, userId: string): Promise<void>;
  /** Entfernt beide atomar und meldet, ob beide noch in der Queue standen. */
  claim(language: Language, firstUserId: string, secondUserId: string): Promise<boolean>;
  entries(language: Language, now: number): Promise<QueueEntry[]>;
  removeUser(userId: string): Promise<void>;
}

export class InMemoryMatchmakingQueue implements MatchmakingQueue {
  private readonly queues = new Map<Language, Map<string, QueueEntry>>();

  async join(language: Language, entry: { userId: string; elo: number }): Promise<void> {
    const queue = this.queues.get(language) ?? new Map<string, QueueEntry>();
    this.queues.set(language, queue);
    const existing = queue.get(entry.userId);
    queue.set(entry.userId, {
      userId: entry.userId,
      elo: entry.elo,
      joinedAt: existing?.joinedAt ?? Date.now(),
    });
  }

  async leave(language: Language, userId: string): Promise<void> {
    this.queues.get(language)?.delete(userId);
  }

  async claim(language: Language, firstUserId: string, secondUserId: string): Promise<boolean> {
    const queue = this.queues.get(language);
    if (!queue?.has(firstUserId) || !queue.has(secondUserId)) return false;
    queue.delete(firstUserId);
    queue.delete(secondUserId);
    return true;
  }

  async entries(language: Language): Promise<QueueEntry[]> {
    return [...(this.queues.get(language)?.values() ?? [])].map((entry) => ({ ...entry }));
  }

  async removeUser(userId: string): Promise<void> {
    for (const queue of this.queues.values()) queue.delete(userId);
  }
}

const REDIS_PREFIX = 'kata-clash:queue';

function queueKey(language: Language): string {
  return `${REDIS_PREFIX}:${language}`;
}

function joinedKey(language: Language): string {
  return `${REDIS_PREFIX}:${language}:joined`;
}

/**
 * Entfernt beide Spieler nur, wenn sie noch in Queue und Zeit-Hash stehen.
 * Lua macht Claim und Aufräumen atomar, damit kein Tick ein doppeltes Match startet.
 */
const CLAIM_SCRIPT = `
local removed = redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2])
if removed == 2 then
  redis.call('HDEL', KEYS[2], ARGV[1], ARGV[2])
end
return removed
`;

/** Nur die Redis-Befehle, die das Matchmaking braucht – hält die Klasse entkoppelt. */
export interface RedisCommands {
  zAdd(key: string, member: { score: number; value: string }): Promise<unknown>;
  zRem(key: string, members: string | string[]): Promise<unknown>;
  zRangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<{ value: string; score: number }[]>;
  hSetNX(key: string, field: string, value: string): Promise<unknown>;
  hDel(key: string, fields: string | string[]): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export class RedisMatchmakingQueue implements MatchmakingQueue {
  constructor(private readonly client: RedisCommands) {}

  async join(language: Language, entry: { userId: string; elo: number }): Promise<void> {
    await Promise.all([
      this.client.zAdd(queueKey(language), { score: entry.elo, value: entry.userId }),
      // Die ursprüngliche Wartezeit bleibt erhalten, auch wenn der Client erneut joint.
      this.client.hSetNX(joinedKey(language), entry.userId, String(Date.now())),
    ]);
  }

  async leave(language: Language, userId: string): Promise<void> {
    await Promise.all([
      this.client.zRem(queueKey(language), userId),
      this.client.hDel(joinedKey(language), userId),
    ]);
  }

  async claim(language: Language, firstUserId: string, secondUserId: string): Promise<boolean> {
    const removed = await this.client.eval(CLAIM_SCRIPT, {
      keys: [queueKey(language), joinedKey(language)],
      arguments: [firstUserId, secondUserId],
    });
    return Number(removed) === 2;
  }

  async entries(language: Language, now: number): Promise<QueueEntry[]> {
    const [members, joined] = await Promise.all([
      this.client.zRangeWithScores(queueKey(language), 0, -1),
      this.client.hGetAll(joinedKey(language)),
    ]);
    return members.map((member) => ({
      userId: member.value,
      elo: member.score,
      joinedAt: Number(joined[member.value]) || now,
    }));
  }

  async removeUser(userId: string): Promise<void> {
    await Promise.all(LANGUAGES.map((language) => this.leave(language, userId)));
  }
}

export interface MatchmakerOptions extends PairingOptions {
  queue: MatchmakingQueue;
  manager: {
    createMatch(input: {
      language: Language;
      players: { userId: string; elo: number }[];
    }): Promise<void>;
  };
  now?: () => number;
  log?: (message: string, error?: unknown) => void;
}

/** Sucht periodisch nach passenden Paaren und übergibt sie dem MatchManager. */
export class Matchmaker {
  private ticking = false;
  private pendingTick = false;
  private readonly now: () => number;

  constructor(private readonly options: MatchmakerOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  async tick(): Promise<void> {
    // Ein Join während eines laufenden Ticks darf nicht verloren gehen.
    if (this.ticking) {
      this.pendingTick = true;
      return;
    }
    this.ticking = true;
    try {
      do {
        this.pendingTick = false;
        await this.tickOnce();
      } while (this.pendingTick);
    } finally {
      this.ticking = false;
    }
  }

  private async tickOnce(): Promise<void> {
    for (const language of LANGUAGES) {
      const now = this.now();
      const entries = await this.options.queue.entries(language, now);
      for (const [first, second] of findPairs(entries, now, this.options)) {
        const claimed = await this.options.queue.claim(language, first.userId, second.userId);
        if (!claimed) continue;
        try {
          await this.options.manager.createMatch({ language, players: [first, second] });
        } catch (error) {
          this.options.log?.(
            'Match konnte nicht erstellt werden; Spieler zurück in die Queue',
            error,
          );
          void this.options.queue.join(language, first).catch(() => {});
          void this.options.queue.join(language, second).catch(() => {});
        }
      }
    }
  }
}
