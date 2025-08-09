import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MockAuthProvider, MockUser } from '../components/MockAuthProvider'

// Mock user for testing
export const mockUser: MockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User'
}

// Wrapper component for tests that need auth context
interface AuthWrapperProps {
  children: React.ReactNode
  user?: MockUser | null
  loading?: boolean
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ 
  children, 
  user = mockUser, 
  loading = false 
}) => {
  // Mock the auth context value
  const mockAuthValue = {
    user,
    loading,
    signIn: jest.fn(),
    signOut: jest.fn()
  }

  return (
    <MockAuthProvider value={mockAuthValue}>
      {children}
    </MockAuthProvider>
  )
}

// Custom render function that includes auth context
export const renderWithAuth = (
  ui: React.ReactElement,
  options?: {
    user?: MockUser | null
    loading?: boolean
    renderOptions?: Omit<RenderOptions, 'wrapper'>
  }
) => {
  const { user, loading, renderOptions } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AuthWrapper user={user} loading={loading}>
        {children}
      </AuthWrapper>
    ),
    ...renderOptions
  })
}

// Mock Supabase client for testing
export const createMockSupabaseClient = () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn()
  })),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null })
  }
})

// Mock group data for tests
export const mockGroup = {
  id: 'group-123',
  name: 'Test Family',
  adults: 2,
  teens: 1,
  kids: 2,
  toddlers: 0,
  dietary_restrictions: ['vegetarian'],
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

// Mock meal data for tests
export const mockMeal = {
  id: 'meal-123',
  title: 'Spaghetti Bolognese',
  description: 'Classic Italian pasta dish',
  prep_time: 30,
  steps: ['Cook pasta', 'Prepare sauce', 'Combine'],
  ingredients: [
    { name: 'spaghetti', amount: '1', unit: 'lb', category: 'grains' },
    { name: 'ground beef', amount: '1', unit: 'lb', category: 'protein' },
    { name: 'tomato sauce', amount: '2', unit: 'cups', category: 'vegetables' }
  ],
  tags: ['italian', 'pasta'],
  starred: false,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'