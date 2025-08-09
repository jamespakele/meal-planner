'use client'

import { createContext, useContext, useState } from 'react'

interface MockUser {
  id: string
  email: string
  name: string
}

interface MockAuthContextType {
  user: MockUser | null
  loading: boolean
  signIn: (email: string, name?: string) => void
  signOut: () => void
}

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined)

export const useMockAuth = () => {
  const context = useContext(MockAuthContext)
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider')
  }
  return context
}

interface MockAuthProviderProps {
  children: React.ReactNode
}

export const MockAuthProvider: React.FC<MockAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<MockUser | null>(() => {
    // Try to get user from localStorage on initial load
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('mockUser')
      return savedUser ? JSON.parse(savedUser) : null
    }
    return null
  })
  const [loading, setLoading] = useState(false)

  const signIn = (email: string, name?: string) => {
    setLoading(true)
    const mockUser: MockUser = {
      id: `user_${Date.now()}`,
      email,
      name: name || email.split('@')[0]
    }
    setUser(mockUser)
    localStorage.setItem('mockUser', JSON.stringify(mockUser))
    setLoading(false)
  }

  const signOut = () => {
    setUser(null)
    localStorage.removeItem('mockUser')
  }

  const value = {
    user,
    loading,
    signIn,
    signOut,
  }

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>
}