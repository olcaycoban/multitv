/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // Docker imajını küçük ve hızlı tutmak için gerekli tüm node_modules'u
  // .next/standalone altında tek bir klasöre topluyor.
  output: 'standalone',
};

module.exports = nextConfig;
