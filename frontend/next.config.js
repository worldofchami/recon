/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === "production" ? "https://recon-638214892937.europe-west3.run.app" : 'http://localhost:8000',
  },
}

module.exports = nextConfig

