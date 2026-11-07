import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** `.env` im Repo-Root – zwei Ebenen über `apps/server/src`. */
export const ROOT_ENV_PATH = fileURLToPath(new URL('../../../.env', import.meta.url));

/**
 * Lädt eine `.env`-Datei in die Umgebung. Bereits gesetzte Variablen behalten
 * Vorrang, damit z. B. CI- oder Produktionswerte nicht überschrieben werden.
 */
export function loadEnvFile(path: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;

  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    env[key] ??= value;
  }
}

// Beim Import ausführen, damit die Werte vor allen anderen Modulen bereitstehen.
loadEnvFile(ROOT_ENV_PATH);
