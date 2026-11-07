import { describe, expect, it } from 'vitest';
import {
  MAX_CODE_LENGTH,
  clientEventSchema,
  codeSubmitSchema,
  matchEndSchema,
  queueJoinSchema,
  serverEventSchema,
} from './index';

describe('shared schemas', () => {
  it('akzeptiert eine gültige Queue-Anfrage', () => {
    expect(queueJoinSchema.safeParse({ language: 'python' }).success).toBe(true);
  });

  it('lehnt unbekannte Sprachen ab', () => {
    expect(queueJoinSchema.safeParse({ language: 'cobol' }).success).toBe(false);
  });

  it('lehnt zu großen Code ab', () => {
    const code = 'x'.repeat(MAX_CODE_LENGTH + 1);
    expect(codeSubmitSchema.safeParse({ matchId: 'm1', code }).success).toBe(false);
  });
});

describe('Duell-Events', () => {
  const kata = {
    slug: 'summe-bis-n',
    title: 'Summe bis n',
    description: 'Addiere alle Zahlen von 1 bis n.',
    difficulty: 'easy' as const,
    timeLimitSec: 300,
    visibleTests: 1,
    totalTests: 3,
    functionName: 'solve',
    starterCode: {
      javascript: 'export function solve(n) { return 0; }',
      python: 'def solve(n):\n    return 0\n',
    },
    tests: [{ id: 't1', name: 'n = 3', args: [3], expected: 6 }],
  };

  it('akzeptiert match:start mit Kata, Countdown und Zeitlimit', () => {
    expect(
      serverEventSchema.safeParse({
        type: 'match:start',
        matchId: 'match-1',
        kata,
        startsAt: 1_700_000_000_000,
        endsAt: 1_700_000_300_000,
      }).success,
    ).toBe(true);
  });

  it('validiert Client-Events samt type-Diskriminator', () => {
    const submit = { type: 'code:submit', matchId: 'match-1', code: 'x' };
    expect(clientEventSchema.safeParse(submit).success).toBe(true);
    expect(clientEventSchema.safeParse({ type: 'code:run', code: 'x' }).success).toBe(false);
    expect(clientEventSchema.safeParse({ type: 'queue:join', language: 'cobol' }).success).toBe(
      false,
    );
  });

  it('erlaubt bei match:end ein Remis, aber keinen unbekannten Grund', () => {
    const draw = { matchId: 'match-1', winnerId: null, reason: 'timeout', eloDelta: 0, endedAt: 1 };
    expect(matchEndSchema.safeParse(draw).success).toBe(true);
    expect(matchEndSchema.safeParse({ ...draw, reason: 'unbekannt' }).success).toBe(false);
  });
});
