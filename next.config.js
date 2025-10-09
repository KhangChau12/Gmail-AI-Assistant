// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    GMAIL_ADDRESS: process.env.GMAIL_ADDRESS,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  }
}

module.exports = nextConfig