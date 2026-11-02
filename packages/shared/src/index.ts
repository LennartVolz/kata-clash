import { z } from 'zod';

export const LANGUAGES = ['javascript', 'python'] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

/** Maximale Codegröße, die Client und Server akzeptieren (Bytes als Zeichen approximiert). */
export const MAX_CODE_LENGTH = 20_000;

export const queueJoinSchema = z.object({
  language: languageSchema,
});
export type QueueJoin = z.infer<typeof queueJoinSchema>;

export const codeSubmitSchema = z.object({
  matchId: z.string().min(1),
  code: z.string().max(MAX_CODE_LENGTH),
});
export type CodeSubmit = z.infer<typeof codeSubmitSchema>;
