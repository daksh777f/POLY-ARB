/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'ws'],
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', '@react-spring/three'],
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
