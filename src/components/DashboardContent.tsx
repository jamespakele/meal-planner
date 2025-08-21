'use client'

import { useAuth } from './AuthProvider'
import { useState, useEffect, useMemo, useCallback } from 'react'
import GroupForm from './GroupForm'
import PlanForm from './PlanForm'
import MealGenerationTrigger from './MealGenerationTrigger'
import FormLinkManager from './FormLinkManager'
import { GroupData } from '@/lib/groupValidation'
import { PlanData } from '@/lib/planValidation'
import { getSupabaseClient } from '@/lib/supabase/singleton'

export default function DashboardContent() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<'groups' | 'plans'>('plans')
  
  // Use singleton client to prevent per-render creation
  const supabase = useMemo(() => getSupabaseClient(), [])

  // Check URL hash on mount to set initial tab
  useEffect(() => {
    const hash = window.location.hash
    if (hash === '#groups') {
      setActiveTab('groups')
    } else if (hash === '#plans') {
      setActiveTab('plans')
    } else {
      // Default to plans if no hash is specified
      setActiveTab('plans')
      window.history.replaceState(null, '', '#plans')
    }
  }, [])

  // Update URL hash when tab changes
  const handleTabChange = (tab: 'groups' | 'plans') => {
    setActiveTab(tab)
    window.history.replaceState(null, '', `#${tab}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meal Planner Dashboard</h1>
              <p className="text-gray-700">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('plans')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plans'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Meal Plans
            </button>
            <button
              onClick={() => handleTabChange('groups')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'groups'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Groups
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'plans' && <PlansTab handleTabChange={handleTabChange} />}
        {activeTab === 'groups' && <GroupsTab />}
      </main>
    </div>
  )
}

function GroupsTab() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use singleton client to prevent per-render creation
  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    if (user) {
      loadGroups()
    }
  }, [user])

  const loadGroups = async () => {
    try {
      setLoading(true)
      const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setGroups(groups || [])
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
      const insertData = {
        name: data.name,
        adults: data.adults,
        teens: data.teens,
        kids: data.kids,
        toddlers: data.toddlers,
        dietary_restrictions: data.dietary_restrictions,
        user_id: user?.id,
        status: 'active'
      }
      
      const { data: newGroup, error } = await supabase
        .from('groups')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('Failed to create group:', error.message)
        throw error
      }

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
      const { data: updatedGroup, error } = await supabase
        .from('groups')
        .update({
          name: data.name,
          adults: data.adults,
          teens: data.teens,
          kids: data.kids,
          toddlers: data.toddlers,
          dietary_restrictions: data.dietary_restrictions
        })
        .eq('id', editingGroup!.id)
        .select()
        .single()

      if (error) throw error

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

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/groups?id=${groupId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete group')
      }

      setGroups(groups.filter(g => g.id !== groupId))
      setError(null)
    } catch (error) {
      console.error('Error deleting group:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete group')
    }
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
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded"
                    >
                      Delete
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

function PlansTab({ handleTabChange }: { handleTabChange: (tab: 'groups' | 'plans') => void }) {
  const { user } = useAuth()
  const [plans, setPlans] = useState<any[]>([])
  const [availableGroups, setAvailableGroups] = useState<any[]>([])
  const [planMealsStatus, setPlanMealsStatus] = useState<Record<string, { hasGeneratedMeals: boolean, jobId: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mealGenerationInProgress, setMealGenerationInProgress] = useState(false)

  // Use singleton client to prevent per-render creation
  const supabase = useMemo(() => getSupabaseClient(), [])

  const loadPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/plans')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load plans')
      }
      
      const data = await response.json()
      setPlans(data.plans || [])
      setError(null)
    } catch (error) {
      console.error('Error loading plans:', error)
      setError(error instanceof Error ? error.message : 'Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setAvailableGroups(groups || [])
      return groups || []
    } catch (error) {
      console.error('Error loading groups:', error)
      return []
    }
  }

  const checkGeneratedMealsForPlans = useCallback(async () => {
    try {
      const mealsStatus: Record<string, { hasGeneratedMeals: boolean, jobId: string | null }> = {}

      // Defensive check: ensure plans exist and are not empty
      if (!plans || plans.length === 0) {
        console.log('No plans available for meal status check')
        return
      }

      // For each plan, check if there are generated meals using API route
      for (const plan of plans) {
        // Defensive check: ensure plan has required properties
        if (!plan || !plan.id || !plan.name) {
          console.warn('Skipping invalid plan:', plan)
          continue
        }

        try {
          const response = await fetch(`/api/meal-generation/status?planId=${encodeURIComponent(plan.name)}`)
          
          if (!response.ok) {
            console.error('Error checking meal generation status for plan:', plan.id, response.statusText)
            mealsStatus[plan.id] = { hasGeneratedMeals: false, jobId: null }
            continue
          }

          const data = await response.json()
          
          if (!data.success) {
            console.error('API error checking meal generation status for plan:', plan.id, data.error)
            mealsStatus[plan.id] = { hasGeneratedMeals: false, jobId: null }
            continue
          }

          // Check if there are completed jobs with meals
          const completedJobs = data.data.jobs.filter((job: any) => job.status === 'completed')
          const hasGeneratedMeals = completedJobs.length > 0 && data.data.meals.length > 0
          const jobId = hasGeneratedMeals && completedJobs.length > 0 ? completedJobs[0].id : null

          mealsStatus[plan.id] = {
            hasGeneratedMeals,
            jobId
          }
        } catch (error) {
          console.error('Error checking meal generation status for plan:', plan.id, error)
          mealsStatus[plan.id] = { hasGeneratedMeals: false, jobId: null }
        }
      }

      setPlanMealsStatus(mealsStatus)
    } catch (error) {
      console.error('Error checking generated meals for plans:', error)
    }
  }, [plans])

  useEffect(() => {
    if (user) {
      loadGroups()
      loadPlans()
    }
  }, [user])

  useEffect(() => {
    if (plans.length > 0) {
      checkGeneratedMealsForPlans()
    }
  }, [plans, checkGeneratedMealsForPlans])

  const handleCreatePlan = async (data: PlanData, planId?: string) => {
    try {
      const { data: newPlan, error } = await supabase
        .from('meal_plans')
        .insert({
          name: data.name,
          week_start: data.week_start,
          notes: data.notes || null,
          group_meals: data.group_meals || [],
          user_id: user?.id,
          status: 'active'
        })
        .select()
        .single()

      if (error) throw error

      setPlans([newPlan, ...plans])
      setShowCreateForm(false)
      setError(null)
    } catch (error) {
      console.error('Error creating plan:', error)
      setError('Failed to create plan')
    }
  }

  const handleEditPlan = async (data: PlanData, planId?: string) => {
    try {
      const { data: updatedPlan, error } = await supabase
        .from('meal_plans')
        .update({
          name: data.name,
          week_start: data.week_start,
          notes: data.notes || null,
          group_meals: data.group_meals || []
        })
        .eq('id', editingPlan!.id)
        .select()
        .single()

      if (error) throw error

      setPlans(plans.map(p => p.id === editingPlan!.id ? updatedPlan : p))
      setEditingPlan(null)
      setError(null)
    } catch (error) {
      console.error('Error updating plan:', error)
      setError('Failed to update plan')
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/plans?id=${planId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete plan')
      }

      setPlans(plans.filter(p => p.id !== planId))
      setError(null)
    } catch (error) {
      console.error('Error deleting plan:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete plan')
    }
  }

  const handleCancelForm = () => {
    setShowCreateForm(false)
    setEditingPlan(null)
    setError(null)
  }

  const handleMealGenerationSuccess = useCallback((planId: string, totalMeals: number) => {
    // You could add a success notification here
    console.log(`Successfully generated ${totalMeals} meals for plan ${planId}`)
    // Refresh the meal status to show the new "View Generated Meals" button
    checkGeneratedMealsForPlans()
  }, [checkGeneratedMealsForPlans])

  const handleMealGenerationError = (error: string) => {
    setError(`Meal generation failed: ${error}`)
  }

  // Helper function to fix legacy group IDs in plans
  const fixLegacyGroupIds = async (planId: string, groupMeals: any[]) => {
    if (!availableGroups.length) return false

    const needsUpdate = groupMeals.some(gm => gm.group_id.startsWith('group-'))
    if (!needsUpdate) return false

    console.log('Attempting to fix legacy group IDs for plan:', planId)

    // Map legacy group IDs to current group IDs by index
    const updatedGroupMeals = groupMeals.map((groupMeal, index) => {
      if (groupMeal.group_id.startsWith('group-') && availableGroups[index]) {
        console.log(`Mapping ${groupMeal.group_id} -> ${availableGroups[index].id} (${availableGroups[index].name})`)
        return {
          ...groupMeal,
          group_id: availableGroups[index].id
        }
      }
      return groupMeal
    })

    // Update the plan in the database
    try {
      const { error } = await supabase
        .from('meal_plans')
        .update({ group_meals: updatedGroupMeals })
        .eq('id', planId)

      if (error) {
        console.error('Failed to update plan with correct group IDs:', error)
        return false
      }

      console.log('Successfully updated plan with correct group IDs')
      // Reload plans to reflect the changes
      loadPlans()
      return true
    } catch (error) {
      console.error('Error updating plan:', error)
      return false
    }
  }

  const getGroupMealsSummary = (plan: any) => {
    if (!plan.group_meals || plan.group_meals.length === 0) {
      // Fallback for plans without group_meals data
      return []
    }

    // Map the stored group_meals to display format
    return plan.group_meals.map((groupMeal: any, index: number) => {
      let group = availableGroups.find(g => g.id === groupMeal.group_id)
      
      // Fallback: If group not found (likely old mock data), try to map by index
      if (!group && groupMeal.group_id.startsWith('group-')) {
        console.warn(`Legacy group ID detected: ${groupMeal.group_id}, attempting to map to current group by index`)
        group = availableGroups[index] // Try to map by index
      }
      
      return {
        name: group?.name || `Unmapped Group (${groupMeal.group_id.slice(-8)})`,
        mealCount: groupMeal.meal_count,
        notes: groupMeal.notes || '',
        needsUpdate: !group || groupMeal.group_id.startsWith('group-') // Flag that this needs updating
      }
    })
  }

  const getTotalMealCount = (plan: any) => {
    if (!plan.group_meals || plan.group_meals.length === 0) {
      return 0
    }
    
    return plan.group_meals.reduce((total: number, groupMeal: any) => {
      return total + (groupMeal.meal_count || 0)
    }, 0)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const noGroupsAvailable = availableGroups.length === 0

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
            <PlanForm
              onSubmit={handleCreatePlan}
              onCancel={handleCancelForm}
              availableGroups={availableGroups}
            />
          </div>
        </div>
      </div>
    )
  }

  if (editingPlan) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <PlanForm
              onSubmit={handleEditPlan}
              onCancel={handleCancelForm}
              initialData={editingPlan}
              availableGroups={availableGroups}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Meal Plans</h2>
        <button 
          onClick={() => setShowCreateForm(true)}
          disabled={noGroupsAvailable}
          className={`font-bold py-2 px-4 rounded ${
            noGroupsAvailable
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-700 text-white'
          }`}
        >
          {noGroupsAvailable ? 'Create Group First' : 'Create New Plan'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {noGroupsAvailable && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 text-blue-500 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-blue-900 mb-2">
              Welcome to Meal Planning!
            </h3>
            <p className="text-blue-700 mb-6 max-w-md mx-auto">
              To start generating personalized meal plans, you&apos;ll first need to define who you&apos;re cooking for. Groups help us understand dietary needs and portion sizes.
            </p>
            <button 
              onClick={() => handleTabChange('groups')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Group
            </button>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-700">Loading plans...</p>
            </div>
          </div>
        </div>
      ) : plans.length === 0 && !noGroupsAvailable ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No meal plans</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating your first meal plan.
              </p>
              <div className="mt-6">
                <button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Create Meal Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {plans.map((plan) => {
              const groupMealsSummary = getGroupMealsSummary(plan)
              const totalMeals = getTotalMealCount(plan)
              
              return (
                <li key={plan.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-medium text-gray-900">{plan.name}</p>
                        <div className="ml-2 flex-shrink-0 flex space-x-2">
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {totalMeals} total meals
                          </p>
                          {planMealsStatus[plan.id]?.hasGeneratedMeals && (
                            <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                              ✓ Meals Generated
                            </p>
                          )}
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            Active
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-800">
                            <span className="mr-2">📅</span>
                            Week of {formatDate(plan.week_start)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Group Meal Assignments */}
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium text-gray-900">Meal Assignments:</p>
                        {groupMealsSummary.length === 0 ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <p className="text-sm text-yellow-800">
                              No meal assignments yet. Edit this plan to assign meals to groups.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {groupMealsSummary.map((groupDetail: any, index: number) => (
                              <div key={index} className="bg-gray-50 rounded-md p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {groupDetail.name}
                                  </span>
                                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
                                    {groupDetail.mealCount} meals
                                  </span>
                                </div>
                                {groupDetail.notes && (
                                  <p className="mt-1 text-xs text-gray-600">
                                    {groupDetail.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Legacy Group ID Warning */}
                        {groupMealsSummary.some((gm: any) => gm.needsUpdate) && (
                          <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-orange-800 font-medium">
                                  ⚠️ This plan uses outdated group references
                                </p>
                                <p className="text-xs text-orange-700 mt-1">
                                  Click &quot;Fix Group References&quot; to update to current groups
                                </p>
                              </div>
                              <button
                                onClick={() => fixLegacyGroupIds(plan.id, plan.group_meals)}
                                className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1 rounded"
                              >
                                Fix Group References
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {plan.notes && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-600">
                            <span className="mr-2">📝</span>
                            <span className="font-medium">Plan Notes:</span> {plan.notes}
                          </p>
                        </div>
                      )}
                      
                      {/* Meal Generation Section */}
                      <div className="mt-4 border-t pt-4">
                        <MealGenerationTrigger
                          plan={plan}
                          onSuccess={handleMealGenerationSuccess}
                          onError={handleMealGenerationError}
                        />
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <div className="flex flex-col space-y-2">
                        <div className="flex space-x-2">
                          {planMealsStatus[plan.id]?.hasGeneratedMeals && planMealsStatus[plan.id]?.jobId && (
                            <a
                              href={`/meals/${planMealsStatus[plan.id].jobId}`}
                              className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded text-sm"
                            >
                              View Generated Meals
                            </a>
                          )}
                          <FormLinkManager 
                            planId={plan.id} 
                            planName={plan.name}
                          />
                          <button
                            onClick={() => setEditingPlan(plan)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}