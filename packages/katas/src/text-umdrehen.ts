import { kataSchema } from '@kata-clash/shared';

export const textUmdrehen = kataSchema.parse({
  slug: 'text-umdrehen',
  title: 'Text umdrehen',
  difficulty: 'easy',
  timeLimitSec: 300,
  functionName: 'solve',
  description: [
    'Gib den übergebenen Text Zeichen für Zeichen in umgekehrter Reihenfolge zurück.',
    '',
    'Beispiel: "hallo" → "ollah"',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// Gibt den Text rueckwaerts zurueck.',
      'function solve(text) {',
      '  return text;',
      '}',
    ].join('\n'),
    python: ['# Gibt den Text rueckwaerts zurueck.', 'def solve(text):', '    return text'].join(
      '\n',
    ),
  },
  tests: [
    { id: 'abc', name: '"abc" ergibt "cba"', args: ['abc'], expected: 'cba' },
    { id: 'leer', name: '"" ergibt ""', args: [''], expected: '' },
    {
      id: 'mit-leerzeichen',
      name: '"Kata Clash" ergibt "hsalC ataK"',
      args: ['Kata Clash'],
      expected: 'hsalC ataK',
      hidden: true,
    },
    { id: 'ein-zeichen', name: '"a" ergibt "a"', args: ['a'], expected: 'a', hidden: true },
  ],
});
