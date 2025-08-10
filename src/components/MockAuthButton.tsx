'use client'

import { useState } from 'react'
import { useMockAuth } from './MockAuthProvider'

export default function MockAuthButton() {
  const { user, loading, signIn, signOut } = useMockAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('demo@example.com')
  const [name, setName] = useState('Demo User')

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span>Loading...</span>
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-800">
          Welcome, {user.name}
        </span>
        <button
          onClick={signOut}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Sign Out
        </button>
      </div>
    )
  }

  if (showLogin) {
    return (
      <div className="flex items-center space-x-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="px-3 py-1 border border-gray-300 rounded text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="px-3 py-1 border border-gray-300 rounded text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={() => signIn(email, name)}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign In
        </button>
        <button
          onClick={() => setShowLogin(false)}
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowLogin(true)}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center space-x-2"
    >
      <span>Quick Sign In (MVP Demo)</span>
    </button>
  )
}