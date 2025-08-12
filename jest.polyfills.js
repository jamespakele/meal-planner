// Polyfills for missing Node.js/Browser APIs in tests

// Mock Next.js Request/Response for API route tests
try {
  const { Request, Response } = require('next/dist/server/web/spec-extension/request')
  global.Request = global.Request || Request
  global.Response = global.Response || Response
} catch (error) {
  // Fallback for when Next.js server APIs are not available
  global.Request = global.Request || class MockRequest {}
  global.Response = global.Response || class MockResponse {}
}

// Mock headers API for server-side code
if (!global.Headers) {
  global.Headers = class Headers {
    constructor() {
      this._headers = new Map()
    }
    
    get(name) {
      return this._headers.get(name.toLowerCase())
    }
    
    set(name, value) {
      this._headers.set(name.toLowerCase(), value)
    }
    
    has(name) {
      return this._headers.has(name.toLowerCase())
    }
  }
}

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn()
}

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key'

// Mock fail function for Jest
global.fail = (message) => {
  throw new Error(message || 'Test failed')
}