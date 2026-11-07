import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadEnvFile } from './env';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeTempEnv(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'kata-clash-env-'));
  tempDirs.push(dir);
  const path = join(dir, '.env');
  writeFileSync(path, contents);
  return path;
}

describe('loadEnvFile', () => {
  it('lädt Variablen, ohne gesetzte Werte zu überschreiben', () => {
    const path = writeTempEnv('AUS_DATEI=ja\nSCHON_GESETZT=aus-datei\n');
    const env: NodeJS.ProcessEnv = { SCHON_GESETZT: 'aus-umgebung' };

    loadEnvFile(path, env);

    expect(env.AUS_DATEI).toBe('ja');
    expect(env.SCHON_GESETZT).toBe('aus-umgebung');
  });

  it('ignoriert eine fehlende Datei', () => {
    const env: NodeJS.ProcessEnv = {};

    loadEnvFile(join(tmpdir(), 'kata-clash-gibt-es-nicht', '.env'), env);

    expect(env).toEqual({});
  });
});
