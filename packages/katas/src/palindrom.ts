import { kataSchema } from '@kata-clash/shared';

export const palindrom = kataSchema.parse({
  slug: 'palindrom',
  title: 'Palindrom erkennen',
  difficulty: 'easy',
  timeLimitSec: 300,
  functionName: 'solve',
  description: [
    'Prüfe, ob der Text vorwärts wie rückwärts gelesen identisch ist.',
    '',
    'Groß- und Kleinschreibung sowie Leerzeichen spielen keine Rolle:',
    '"Lagerregal" ist ein Palindrom, "Kata Clash" nicht.',
    '',
    'Beispiel: "Level" → true, "Hallo" → false',
  ].join('\n'),
  starterCode: {
    javascript: [
      '// true, wenn der Text ein Palindrom ist.',
      'function solve(text) {',
      '  return false;',
      '}',
    ].join('\n'),
    python: [
      '# True, wenn der Text ein Palindrom ist.',
      'def solve(text):',
      '    return False',
    ].join('\n'),
  },
  tests: [
    { id: 'level', name: '"Level" ergibt true', args: ['Level'], expected: true },
    { id: 'hallo', name: '"Hallo" ergibt false', args: ['Hallo'], expected: false },
    {
      id: 'lagerregal',
      name: '"Lagerregal" ergibt true',
      args: ['Lagerregal'],
      expected: true,
      hidden: true,
    },
    { id: 'abba', name: '"abba" ergibt true', args: ['abba'], expected: true, hidden: true },
  ],
});
