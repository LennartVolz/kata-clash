import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import type { NextConfig } from 'next';

// Next liest im Monorepo nur apps/web/.env* – die gemeinsame Root-.env daher
// selbst laden. Bereits gesetzte Variablen bleiben vorrangig.
const rootEnvPath = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvPath)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnvPath, 'utf8')))) {
    process.env[key] ??= value;
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Das DB-Paket liefert TypeScript-Quellen (inkl. generiertem Prisma-Client).
  transpilePackages: ['@kata-clash/db'],
  // pg bleibt ein echtes Node-Paket statt gebündelt zu werden.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
