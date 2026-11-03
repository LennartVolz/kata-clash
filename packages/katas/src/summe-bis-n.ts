import { kataSchema } from '@kata-clash/shared';

export const summeBisN = kataSchema.parse({
  slug: 'summe-bis-n',
  title: 'Summe bis n',
  difficulty: 'easy',
  timeLimitSec: 300,
  functionName: 'solve',
  description: [
    'Berechne die Summe aller ganzen Zahlen von 1 bis n (jeweils inklusive).',
    '',
    'Für n < 1 ist das Ergebnis 0.',
    '',
    'Beispiel: n = 5 → 1 + 2 + 3 + 4 + 5 = 15',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// Summe aller ganzen Zahlen von 1 bis n (inklusive); n < 1 ergibt 0.',
      'function solve(n) {',
      '  return 0;',
      '}',
    ].join('\n'),
    python: [
      '# Summe aller ganzen Zahlen von 1 bis n (inklusive); n < 1 ergibt 0.',
      'def solve(n):',
      '    return 0',
    ].join('\n'),
  },
  tests: [
    { id: 'n-5', name: 'n = 5 ergibt 15', args: [5], expected: 15 },
    { id: 'n-1', name: 'n = 1 ergibt 1', args: [1], expected: 1 },
    { id: 'n-0', name: 'n = 0 ergibt 0', args: [0], expected: 0, hidden: true },
    {
      id: 'n-1000',
      name: 'n = 1000 ergibt 500500',
      args: [1000],
      expected: 500500,
      hidden: true,
    },
  ],
});
