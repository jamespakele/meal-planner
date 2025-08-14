/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 15
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Only apply in development mode
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/__tests__/**',
          '**/test/**',
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.spec.{js,jsx,ts,tsx}',
          '**/jest.*.js',
          '**/jest.config.js'
        ]
      }
    }
    
    return config
  }
}

module.exports = nextConfig