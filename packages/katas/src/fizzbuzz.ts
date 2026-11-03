import { kataSchema } from '@kata-clash/shared';

export const fizzbuzz = kataSchema.parse({
  slug: 'fizzbuzz',
  title: 'FizzBuzz',
  difficulty: 'easy',
  timeLimitSec: 300,
  functionName: 'solve',
  description: [
    'Gib für die Zahlen 1 bis n ein Array aus Texten zurück:',
    '',
    'durch 3 und 5 teilbar → "FizzBuzz"',
    'nur durch 3 teilbar → "Fizz"',
    'nur durch 5 teilbar → "Buzz"',
    'sonst die Zahl selbst als Text.',
    '',
    'Beispiel: n = 5 → ["1", "2", "Fizz", "4", "Buzz"]',
  ].join('\n'),
  starterCode: {
    javascript: ['// FizzBuzz fuer 1 bis n.', 'function solve(n) {', '  return [];', '}'].join(
      '\n',
    ),
    python: ['# FizzBuzz fuer 1 bis n.', 'def solve(n):', '    return []'].join('\n'),
  },
  tests: [
    {
      id: 'n-3',
      name: 'n = 3 ergibt ["1", "2", "Fizz"]',
      args: [3],
      expected: ['1', '2', 'Fizz'],
    },
    {
      id: 'n-5',
      name: 'n = 5 ergibt ["1", "2", "Fizz", "4", "Buzz"]',
      args: [5],
      expected: ['1', '2', 'Fizz', '4', 'Buzz'],
    },
    {
      id: 'n-15',
      name: 'n = 15 endet auf "FizzBuzz"',
      args: [15],
      expected: [
        '1',
        '2',
        'Fizz',
        '4',
        'Buzz',
        'Fizz',
        '7',
        '8',
        'Fizz',
        'Buzz',
        '11',
        'Fizz',
        '13',
        '14',
        'FizzBuzz',
      ],
      hidden: true,
    },
    { id: 'n-1', name: 'n = 1 ergibt ["1"]', args: [1], expected: ['1'], hidden: true },
  ],
});
