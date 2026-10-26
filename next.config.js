/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Native / Node-only modules must not be bundled by webpack.
    serverComponentsExternalPackages: ['better-sqlite3', 'imapflow', 'mailparser', 'nodemailer'],
  },
};

module.exports = nextConfig;
