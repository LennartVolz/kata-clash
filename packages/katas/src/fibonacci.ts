import { kataSchema } from '@kata-clash/shared';

export const fibonacci = kataSchema.parse({
  slug: 'fibonacci',
  title: 'Fibonacci-Zahl',
  difficulty: 'medium',
  timeLimitSec: 420,
  functionName: 'solve',
  description: [
    'Gib die n-te Fibonacci-Zahl zurück. Die Folge beginnt mit 0 und 1:',
    '0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, …',
    '',
    'Beispiel: n = 10 → 55',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// n-te Fibonacci-Zahl (F(0) = 0, F(1) = 1).',
      'function solve(n) {',
      '  return 0;',
      '}',
    ].join('\n'),
    python: ['# n-te Fibonacci-Zahl (F(0) = 0, F(1) = 1).', 'def solve(n):', '    return 0'].join(
      '\n',
    ),
  },
  tests: [
    { id: 'n-0', name: 'n = 0 ergibt 0', args: [0], expected: 0 },
    { id: 'n-10', name: 'n = 10 ergibt 55', args: [10], expected: 55 },
    { id: 'n-1', name: 'n = 1 ergibt 1', args: [1], expected: 1, hidden: true },
    { id: 'n-20', name: 'n = 20 ergibt 6765', args: [20], expected: 6765, hidden: true },
  ],
});
