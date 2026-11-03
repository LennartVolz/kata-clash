import { kataSchema } from '@kata-clash/shared';

export const maxSumme = kataSchema.parse({
  slug: 'max-summe',
  title: 'Größte Teilsumme',
  difficulty: 'medium',
  timeLimitSec: 420,
  functionName: 'solve',
  description: [
    'Finde die größte Summe eines zusammenhängenden Abschnitts im Zahlen-Array.',
    '',
    'Der Abschnitt muss mindestens eine Zahl enthalten, auch wenn alle Zahlen negativ sind.',
    '',
    'Beispiel: [-2, 1, -3, 4, -1, 2, 1, -5, 4] → 6 (Abschnitt [4, -1, 2, 1])',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// Groesste Summe eines zusammenhaengenden Abschnitts.',
      'function solve(zahlen) {',
      '  return 0;',
      '}',
    ].join('\n'),
    python: [
      '# Groesste Summe eines zusammenhaengenden Abschnitts.',
      'def solve(zahlen):',
      '    return 0',
    ].join('\n'),
  },
  tests: [
    {
      id: 'klassisch',
      name: '[-2, 1, -3, 4, -1, 2, 1, -5, 4] ergibt 6',
      args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]],
      expected: 6,
    },
    { id: 'eine-zahl', name: '[1] ergibt 1', args: [[1]], expected: 1 },
    {
      id: 'nur-negativ',
      name: '[-3, -1, -2] ergibt -1',
      args: [[-3, -1, -2]],
      expected: -1,
      hidden: true,
    },
    { id: 'gemischt', name: '[5, -2, 3] ergibt 6', args: [[5, -2, 3]], expected: 6, hidden: true },
  ],
});
