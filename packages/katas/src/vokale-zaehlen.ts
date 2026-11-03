import { kataSchema } from '@kata-clash/shared';

export const vokaleZaehlen = kataSchema.parse({
  slug: 'vokale-zaehlen',
  title: 'Vokale zählen',
  difficulty: 'easy',
  timeLimitSec: 300,
  functionName: 'solve',
  description: [
    'Zähle alle Vokale (a, e, i, o, u) im Text – unabhängig von der Schreibweise.',
    '',
    'Beispiel: "Hallo Welt" → 3',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// Anzahl der Vokale im Text.',
      'function solve(text) {',
      '  return 0;',
      '}',
    ].join('\n'),
    python: ['# Anzahl der Vokale im Text.', 'def solve(text):', '    return 0'].join('\n'),
  },
  tests: [
    { id: 'hallo-welt', name: '"Hallo Welt" ergibt 3', args: ['Hallo Welt'], expected: 3 },
    { id: 'ohne-vokal', name: '"xyz" ergibt 0', args: ['xyz'], expected: 0 },
    { id: 'gross', name: '"AEIOU" ergibt 5', args: ['AEIOU'], expected: 5, hidden: true },
    { id: 'leer', name: '"" ergibt 0', args: [''], expected: 0, hidden: true },
  ],
});
