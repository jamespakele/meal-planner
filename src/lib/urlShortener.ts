import crypto from 'crypto'

// Base62 character set for URL-safe short codes
const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const SHORT_CODE_LENGTH = 8 // Results in ~218 trillion possible codes

/**
 * Generate a short code for a form link token
 * Uses role prefix + base62 encoding for human-readable URLs
 */
export function generateShortCode(role: 'co_manager' | 'other', maxRetries = 5): string {
  const prefix = role === 'co_manager' ? 'cm' : 'ot'
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Generate random bytes and encode to base62
    const randomBytes = crypto.randomBytes(6) // 6 bytes = 48 bits
    let code = ''
    
    // Convert bytes to base62
    for (let i = 0; i < randomBytes.length; i++) {
      const byte = randomBytes[i]
      code += BASE62_CHARS[byte % 62]
    }
    
    // Pad to desired length if needed
    while (code.length < SHORT_CODE_LENGTH - prefix.length) {
      code += BASE62_CHARS[Math.floor(Math.random() * 62)]
    }
    
    const shortCode = prefix + code.substring(0, SHORT_CODE_LENGTH - prefix.length)
    
    // Basic collision avoidance - ensure we don't have obviously problematic codes
    if (!hasProblematicPattern(shortCode)) {
      return shortCode
    }
  }
  
  throw new Error('Failed to generate short code after maximum retries')
}

/**
 * Extract role from short code
 */
export function extractRoleFromShortCode(shortCode: string): 'co_manager' | 'other' | null {
  if (shortCode.startsWith('cm')) return 'co_manager'
  if (shortCode.startsWith('ot')) return 'other'
  return null
}

/**
 * Generate full public URL for a short code
 */
export function generatePublicUrl(shortCode: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/f/${shortCode}`
}

/**
 * Check for potentially problematic patterns in short codes
 */
function hasProblematicPattern(code: string): boolean {
  const problematicPatterns = [
    /^(cm|ot)(000|111|aaa|AAA)/i, // Repetitive patterns
    /^(cm|ot).*(fuck|shit|damn)/i, // Basic profanity filter
    /^(cm|ot)(api|www|app|dev)/i,  // Reserved words
  ]
  
  return problematicPatterns.some(pattern => pattern.test(code))
}

/**
 * Validate short code format
 */
export function isValidShortCode(shortCode: string): boolean {
  if (!shortCode || typeof shortCode !== 'string') return false
  if (shortCode.length !== SHORT_CODE_LENGTH) return false
  if (!shortCode.startsWith('cm') && !shortCode.startsWith('ot')) return false
  
  // Check that remaining characters are valid base62
  const suffix = shortCode.substring(2)
  return /^[0-9A-Za-z]+$/.test(suffix)
}

/**
 * Interface for short code mapping (for future database storage if needed)
 */
export interface ShortCodeMapping {
  shortCode: string
  publicToken: string
  role: 'co_manager' | 'other'
  createdAt: Date
  expiresAt?: Date
  views: number
}

/**
 * In-memory cache for short code to token mapping
 * In production, this would be stored in Redis or database
 */
const shortCodeCache = new Map<string, ShortCodeMapping>()

/**
 * Cache a short code mapping
 */
export function cacheShortCodeMapping(mapping: ShortCodeMapping): void {
  shortCodeCache.set(mapping.shortCode, mapping)
  
  // Clean up expired entries periodically (simple cleanup)
  if (shortCodeCache.size > 10000) {
    const now = new Date()
    for (const [code, entry] of Array.from(shortCodeCache.entries())) {
      if (entry.expiresAt && entry.expiresAt < now) {
        shortCodeCache.delete(code)
      }
    }
  }
}

/**
 * Resolve short code to public token
 */
export function resolveShortCode(shortCode: string): ShortCodeMapping | null {
  const mapping = shortCodeCache.get(shortCode)
  
  if (!mapping) return null
  if (mapping.expiresAt && mapping.expiresAt < new Date()) {
    shortCodeCache.delete(shortCode)
    return null
  }
  
  return mapping
}

/**
 * Increment view count for a short code
 */
export function incrementShortCodeViews(shortCode: string): void {
  const mapping = shortCodeCache.get(shortCode)
  if (mapping) {
    mapping.views += 1
    shortCodeCache.set(shortCode, mapping)
  }
}

/**
 * Clear short code cache (for testing)
 */
export function clearShortCodeCache(): void {
  shortCodeCache.clear()
}