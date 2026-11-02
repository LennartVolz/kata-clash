import { describe, expect, it } from 'vitest';
import { MAX_CODE_LENGTH, codeSubmitSchema, queueJoinSchema } from './index';

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
