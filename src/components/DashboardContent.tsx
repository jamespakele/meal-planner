'use client'

import { useMockAuth } from './MockAuthProvider'
import { useState, useEffect } from 'react'
import MockAuthButton from './MockAuthButton'
import GroupForm from './GroupForm'
import { GroupData } from '@/lib/groupValidation'
import { getStoredGroups, storeGroup, StoredGroup } from '@/lib/mockStorage'

export default function DashboardContent() {
  const { user } = useMockAuth()
  const [activeTab, setActiveTab] = useState<'groups' | 'plans'>('groups')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meal Planner Dashboard</h1>
              <p className="text-gray-700">Welcome back, {user?.name || user?.email}</p>
            </div>
            <MockAuthButton />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('groups')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'groups'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Meal Plans
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'plans' && <PlansTab />}
      </main>
    </div>
  )
}

function GroupsTab() {
  const [groups, setGroups] = useState<StoredGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<StoredGroup | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = () => {
    try {
      setLoading(true)
      const storedGroups = getStoredGroups()
      setGroups(storedGroups)
      setError(null)
    } catch (error) {
      console.error('Error loading groups:', error)
      setError('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroup = async (data: GroupData) => {
    try {
      const newGroup: StoredGroup = {
        id: `group-${Date.now()}`,
        ...data,
        user_id: 'mock-user-123',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      storeGroup(newGroup)
      setGroups([newGroup, ...groups])
      setShowCreateForm(false)
      setError(null)
    } catch (error) {
      console.error('Error creating group:', error)
      setError('Failed to create group')
    }
  }

  const handleEditGroup = async (data: GroupData) => {
    try {
      const updatedGroup: StoredGroup = {
        ...editingGroup!,
        ...data,
        updated_at: new Date().toISOString()
      }
      
      storeGroup(updatedGroup)
      setGroups(groups.map(g => g.id === editingGroup!.id ? updatedGroup : g))
      setEditingGroup(null)
      setError(null)
    } catch (error) {
      console.error('Error updating group:', error)
      setError('Failed to update group')
    }
  }

  const handleCancelForm = () => {
    setShowCreateForm(false)
    setEditingGroup(null)
    setError(null)
  }

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <GroupForm
              onSubmit={handleCreateGroup}
              onCancel={handleCancelForm}
            />
          </div>
        </div>
      </div>
    )
  }

  if (editingGroup) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <GroupForm
              onSubmit={handleEditGroup}
              onCancel={handleCancelForm}
              initialData={editingGroup}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Your Groups</h2>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Create New Group
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-700">Loading groups...</p>
            </div>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-700">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No groups</h3>
              <p className="mt-1 text-sm text-gray-800">
                Get started by creating your first group.
              </p>
              <div className="mt-6">
                <button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {groups.map((group) => (
              <li key={group.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-medium text-gray-900">{group.name}</p>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-800">
                          <span className="mr-2">👥</span>
                          {group.adults} adults, {group.teens} teens, {group.kids} kids, {group.toddlers} toddlers
                        </p>
                      </div>
                      {group.dietary_restrictions.length > 0 && (
                        <div className="mt-2 flex items-center text-sm text-gray-800 sm:mt-0">
                          <span className="mr-2">🥗</span>
                          {group.dietary_restrictions.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      onClick={() => setEditingGroup(group)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded mr-2"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PlansTab() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Meal Plans</h2>
        <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Generate New Plan
        </button>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-600">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No meal plans</h3>
            <p className="mt-1 text-sm text-gray-700">
              Create a group first, then generate your first meal plan.
            </p>
            <div className="mt-6">
              <button 
                className="bg-gray-400 text-white font-bold py-2 px-4 rounded cursor-not-allowed"
                disabled
              >
                Generate Plan (Create Group First)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}