import { fileURLToPath } from 'url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@shift-saas/types'],
  turbopack: {
    root: fileURLToPath(new URL('../..', import.meta.url)),
  },
}

export default nextConfig
