import { describe, expect, it } from 'vitest';

import { DEFAULT_LIMITS } from './config';
import { buildDockerArgs, type SandboxRunSpec } from './docker';

const spec: SandboxRunSpec = {
  binary: 'docker',
  name: 'kata-run-test',
  image: 'kata-clash/js:latest',
  command: ['node', '/opt/kata/harness.cjs'],
  workDir: '/tmp/kata-run-abc',
  limits: DEFAULT_LIMITS,
  env: { KATA_CODE: '/work/solution.cjs' },
};

function valueOf(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

describe('buildDockerArgs', () => {
  it('setzt alle Härtungs-Flags aus SECURITY.md', () => {
    const args = buildDockerArgs(spec);

    expect(args[0]).toBe('run');
    expect(valueOf(args, '--network')).toBe('none');
    expect(args).toContain('--read-only');
    expect(valueOf(args, '--memory')).toBe(`${DEFAULT_LIMITS.memoryMb}m`);
    // memory-swap = memory deaktiviert Swap, sonst greift das RAM-Limit nicht.
    expect(valueOf(args, '--memory-swap')).toBe(`${DEFAULT_LIMITS.memoryMb}m`);
    expect(valueOf(args, '--cpus')).toBe(String(DEFAULT_LIMITS.cpus));
    expect(valueOf(args, '--pids-limit')).toBe(String(DEFAULT_LIMITS.pidsLimit));
    expect(valueOf(args, '--ulimit')).toBe(
      `nofile=${DEFAULT_LIMITS.maxOpenFiles}:${DEFAULT_LIMITS.maxOpenFiles}`,
    );
    expect(valueOf(args, '--cap-drop')).toBe('ALL');
    expect(valueOf(args, '--security-opt')).toBe('no-new-privileges');
    expect(valueOf(args, '--user')).toBe('10001:10001');
    expect(args).toContain('--init');
  });

  it('mountet Code read-only und beschränkt /tmp per tmpfs', () => {
    const args = buildDockerArgs(spec);

    expect(args).toContain('/tmp/kata-run-abc:/work:ro');
    expect(args).toContain('-w');
    expect(valueOf(args, '--tmpfs')).toContain('noexec');
    expect(valueOf(args, '--tmpfs')).toContain(`size=${DEFAULT_LIMITS.tmpfsMb}m`);
    expect(args).not.toContain('--privileged');
  });

  it('übergibt Umgebung und Kommando erst nach dem Image', () => {
    const args = buildDockerArgs(spec);
    const imageIndex = args.indexOf(spec.image);

    expect(args).toContain('KATA_CODE=/work/solution.cjs');
    expect(imageIndex).toBeGreaterThan(0);
    expect(args.slice(imageIndex + 1)).toEqual(['node', '/opt/kata/harness.cjs']);
  });
});
