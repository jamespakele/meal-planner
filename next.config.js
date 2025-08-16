/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 15
  experimental: {
    // Disable Jest workers in development
    forceSwcTransforms: true,
  },
  webpack: (config, { dev, isServer }) => {
    // Completely exclude test files from all builds
    config.module.rules.push({
      test: /\.(test|spec)\.(js|jsx|ts|tsx)$/,
      use: 'ignore-loader'
    })
    
    // Exclude Jest-related files
    config.module.rules.push({
      test: /jest\.(config|setup|polyfills)\.js$/,
      use: 'ignore-loader'
    })
    
    // Exclude __tests__ directories
    config.module.rules.push({
      test: /\/__tests__\//,
      use: 'ignore-loader'
    })
    
    if (dev) {
      // Enhanced development exclusions
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/__tests__/**',
          '**/test/**',
          '**/tests/**',
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.spec.{js,jsx,ts,tsx}',
          '**/jest.*.js',
          '**/jest.config.js',
          '**/coverage/**',
          '**/node_modules/.cache/jest/**'
        ]
      }
      
      // Prevent Jest worker processes in development
      config.resolve.alias = {
        ...config.resolve.alias,
        'jest-worker': false,
        '@jest/workers': false
      }
    }
    
    // Exclude test utilities from production builds
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/src/__tests__/utils/testUtils': false
      }
    }
    
    return config
  }
}

module.exports = nextConfig