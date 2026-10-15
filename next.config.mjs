/** @type {import('next').NextConfig} */
const nextConfig = {
  // do not generate assistant instruction files in the repo
  agentRules: false,
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};
export default nextConfig;
