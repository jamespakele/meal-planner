import '@testing-library/jest-dom'
import { config } from 'dotenv'
import path from 'path'

// Load environment variables from .env.local for tests
config({ path: path.resolve(process.cwd(), '.env.local') })

// Ensure Supabase environment variables are available for tests
// Map from the NEXT_PUBLIC_* variables loaded from .env.local
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
}
if (!process.env.SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}