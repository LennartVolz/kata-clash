import { kataSchema } from '@kata-clash/shared';

export const zweiSummen = kataSchema.parse({
  slug: 'zwei-summen',
  title: 'Zwei Summen',
  difficulty: 'medium',
  timeLimitSec: 420,
  functionName: 'solve',
  description: [
    'Finde zwei Zahlen im Array, deren Summe dem Ziel entspricht, und gib ihre',
    'Indizes als Array zurück – der kleinere Index zuerst.',
    '',
    'Jede Zahl darf nur einmal verwendet werden, und es gibt genau eine Lösung.',
    '',
    'Beispiel: [2, 7, 11, 15] mit Ziel 9 → [0, 1] (2 + 7 = 9)',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// Indizes der beiden Zahlen, die zusammen das Ziel ergeben.',
      'function solve(zahlen, ziel) {',
      '  return [];',
      '}',
    ].join('\n'),
    python: [
      '# Indizes der beiden Zahlen, die zusammen das Ziel ergeben.',
      'def solve(zahlen, ziel):',
      '    return []',
    ].join('\n'),
  },
  tests: [
    {
      id: 'klassisch',
      name: '[2, 7, 11, 15] mit Ziel 9 ergibt [0, 1]',
      args: [[2, 7, 11, 15], 9],
      expected: [0, 1],
    },
    {
      id: 'hinten',
      name: '[3, 2, 4] mit Ziel 6 ergibt [1, 2]',
      args: [[3, 2, 4], 6],
      expected: [1, 2],
    },
    {
      id: 'doppelt',
      name: '[3, 3] mit Ziel 6 ergibt [0, 1]',
      args: [[3, 3], 6],
      expected: [0, 1],
      hidden: true,
    },
    {
      id: 'kurz',
      name: '[1, 2] mit Ziel 3 ergibt [0, 1]',
      args: [[1, 2], 3],
      expected: [0, 1],
      hidden: true,
    },
  ],
});
