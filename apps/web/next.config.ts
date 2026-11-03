import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Die Kata-Seiten lesen live von der API; nichts wird vorgerendert.
  reactStrictMode: true,
};

export default nextConfig;
