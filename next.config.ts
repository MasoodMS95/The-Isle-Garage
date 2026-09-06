import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  logging: false,
  serverExternalPackages: ['pg', '@node-rs/argon2'],
  experimental: { proxyClientMaxBodySize: '17mb' },
};
export default config;
