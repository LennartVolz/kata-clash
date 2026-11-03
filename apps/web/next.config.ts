import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Das DB-Paket liefert TypeScript-Quellen (inkl. generiertem Prisma-Client).
  transpilePackages: ['@kata-clash/db'],
  // pg bleibt ein echtes Node-Paket statt gebündelt zu werden.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
