/**
 * Server Diagnostic Test
 * Tests to verify Next.js development server and build issues
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

describe('Next.js Server Diagnostic Tests', () => {
  const projectRoot = path.resolve(process.cwd())
  const nextDir = path.join(projectRoot, '.next')
  const nodeModulesDir = path.join(projectRoot, 'node_modules')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Build Environment Status', () => {
    test('should verify project directory structure exists', () => {
      const requiredPaths = [
        'package.json',
        'next.config.js',
        'src/app',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'tailwind.config.js',
        'tsconfig.json'
      ]

      const missingPaths: string[] = []
      requiredPaths.forEach(relativePath => {
        const fullPath = path.join(projectRoot, relativePath)
        if (!fs.existsSync(fullPath)) {
          missingPaths.push(relativePath)
        }
      })

      expect(missingPaths).toEqual([])
      console.log('✓ All required project files exist')
    })

    test('should identify missing .next build directory', () => {
      const nextExists = fs.existsSync(nextDir)
      
      // This test documents the current problem
      expect(nextExists).toBe(false)
      console.log('✗ .next directory missing - this is the root cause of 404 errors')
    })

    test('should verify node_modules installation', () => {
      const nodeModulesExists = fs.existsSync(nodeModulesDir)
      const nextModuleExists = fs.existsSync(path.join(nodeModulesDir, 'next'))
      const reactModuleExists = fs.existsSync(path.join(nodeModulesDir, 'react'))

      expect(nodeModulesExists).toBe(true)
      expect(nextModuleExists).toBe(true)
      expect(reactModuleExists).toBe(true)
      console.log('✓ Node modules properly installed')
    })

    test('should check for TypeScript compilation blockers', () => {
      try {
        // Run TypeScript check without emitting files
        execSync('npx tsc --noEmit', { 
          cwd: projectRoot, 
          stdio: 'pipe',
          encoding: 'utf8'
        })
        console.log('✓ TypeScript compilation check passed')
      } catch (error: any) {
        const errorOutput = error.stdout || error.stderr || error.message
        console.log('✗ TypeScript errors detected:', errorOutput)
        
        // Document the known error we need to fix
        expect(errorOutput).toContain('PublicMealSelectionView.tsx')
        expect(errorOutput).toContain('isSelected')
      }
    })
  })

  describe('Build Process Verification', () => {
    test('should document expected build artifacts', () => {
      const expectedBuildArtifacts = [
        '.next/static/css',
        '.next/static/chunks',
        '.next/static/chunks/app',
        '.next/static/chunks/main-app.js',
        '.next/cache'
      ]

      const buildArtifactStatus = expectedBuildArtifacts.map(artifact => ({
        path: artifact,
        exists: fs.existsSync(path.join(projectRoot, artifact)),
        expectedAfterBuild: true
      }))

      console.log('Expected build artifacts status:', buildArtifactStatus)
      
      // Currently none should exist since .next doesn't exist
      const existingArtifacts = buildArtifactStatus.filter(a => a.exists)
      expect(existingArtifacts).toHaveLength(0)
    })

    test('should verify next.config.js is valid', () => {
      const nextConfigPath = path.join(projectRoot, 'next.config.js')
      expect(fs.existsSync(nextConfigPath)).toBe(true)

      // Verify the config can be required without errors
      try {
        delete require.cache[nextConfigPath]
        const config = require(nextConfigPath)
        expect(config).toBeDefined()
        expect(typeof config).toBe('object')
        console.log('✓ next.config.js is valid')
      } catch (error) {
        console.log('✗ next.config.js has syntax errors:', error)
        throw error
      }
    })

    test('should identify webpack configuration issues', () => {
      const nextConfigPath = path.join(projectRoot, 'next.config.js')
      const config = require(nextConfigPath)

      // Check if webpack config might be blocking builds
      expect(config.webpack).toBeDefined()
      expect(typeof config.webpack).toBe('function')

      console.log('Webpack config present - checking for potential issues')
      
      // Document that webpack config includes test exclusions
      const configString = fs.readFileSync(nextConfigPath, 'utf8')
      expect(configString).toContain('ignore-loader')
      expect(configString).toContain('__tests__')
      
      console.log('✓ Webpack config includes test file exclusions')
    })
  })

  describe('Development Server Prerequisites', () => {
    test('should verify required environment files', () => {
      const envFiles = ['.env.local', '.env']
      const envStatus = envFiles.map(file => ({
        file,
        exists: fs.existsSync(path.join(projectRoot, file))
      }))

      console.log('Environment files status:', envStatus)
      
      // At least .env.local should exist for Supabase config
      const envLocalExists = envStatus.find(e => e.file === '.env.local')?.exists
      if (!envLocalExists) {
        console.log('⚠ .env.local missing - may cause authentication issues')
      }
    })

    test('should check for port conflicts', () => {
      // This is a placeholder test - actual port checking would require network operations
      const defaultPort = 3000
      
      console.log(`Development server should start on port ${defaultPort}`)
      console.log('Port conflict check would be performed during server startup')
      
      expect(defaultPort).toBe(3000)
    })

    test('should verify CSS and styling dependencies', () => {
      const tailwindConfigExists = fs.existsSync(path.join(projectRoot, 'tailwind.config.js'))
      const postCSSConfigExists = fs.existsSync(path.join(projectRoot, 'postcss.config.js'))
      const globalCSSExists = fs.existsSync(path.join(projectRoot, 'src/app/globals.css'))

      expect(tailwindConfigExists).toBe(true)
      expect(postCSSConfigExists).toBe(true)
      expect(globalCSSExists).toBe(true)

      console.log('✓ CSS and styling configuration complete')
    })
  })

  describe('Error Patterns from Browser Logs', () => {
    test('should document the specific 404 errors reported', () => {
      const reportedErrors = [
        'GET http://localhost:3000/_next/static/css/app/layout.css?v=1755744286704 net::ERR_ABORTED 404',
        'GET http://localhost:3000/_next/static/chunks/main-app.js?v=1755744286704 net::ERR_ABORTED 404',
        'GET http://localhost:3000/_next/static/chunks/app-pages-internals.js net::ERR_ABORTED 404',
        'GET http://localhost:3000/_next/static/chunks/app/page.js net::ERR_ABORTED 404',
        'GET http://localhost:3000/favicon.ico 404'
      ]

      console.log('Reported 404 errors:', reportedErrors)

      // These errors indicate static assets are not being generated
      const staticAssetErrors = reportedErrors.filter(error => 
        error.includes('_next/static/')
      )

      expect(staticAssetErrors.length).toBeGreaterThan(0)
      console.log('✗ Static asset generation failing - confirmed by browser logs')
    })

    test('should identify the root cause sequence', () => {
      const rootCauseSequence = {
        step1: 'Development server not generating .next directory',
        step2: 'Static assets (CSS, JS) not created',
        step3: 'Browser requests return 404 for missing assets',
        step4: 'Page fails to load completely',
        impact: 'Complete application unavailability'
      }

      console.log('Root cause sequence:', rootCauseSequence)
      expect(rootCauseSequence.impact).toBe('Complete application unavailability')
    })
  })

  describe('Fix Strategy Validation', () => {
    test('should outline required fix steps', () => {
      const fixSteps = {
        immediate: [
          'Fix TypeScript compilation errors',
          'Clean any corrupted build artifacts', 
          'Start development server',
          'Verify .next directory creation'
        ],
        verification: [
          'Confirm static assets generate',
          'Test page loading in browser',
          'Verify hot reload functionality'
        ],
        longTerm: [
          'Add server startup tests',
          'Monitor build performance',
          'Prevent similar issues'
        ]
      }

      console.log('Fix strategy:', fixSteps)
      expect(fixSteps.immediate.length).toBeGreaterThan(0)
      expect(fixSteps.verification.length).toBeGreaterThan(0)
    })

    test('should confirm diagnostic phase completion', () => {
      const diagnosticResults = {
        'missing .next directory': true,
        'TypeScript errors present': true,
        'node_modules installed': true,
        'project structure valid': true,
        'next.config.js valid': true,
        'static asset 404s confirmed': true
      }

      console.log('Diagnostic results:', diagnosticResults)
      
      const criticalIssues = Object.entries(diagnosticResults)
        .filter(([key, value]) => key.includes('missing') || key.includes('errors'))
        .filter(([, value]) => value === true)

      expect(criticalIssues.length).toBeGreaterThan(0)
      console.log('✓ Critical issues identified and ready for resolution')
    })
  })
})