'use client'

import { useAuth } from './AuthProvider'
import { useState, useEffect, useMemo } from 'react'
import GroupForm from './GroupForm'
import PlanForm from './PlanForm'
import { GroupData } from '@/lib/groupValidation'
import { PlanData } from '@/lib/planValidation'
import { getSupabaseClient } from '@/lib/supabase/singleton'

export default function DashboardContent() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<'groups' | 'plans'>('groups')
  
  // Use singleton client to prevent per-render creation
  const supabase = useMemo(() => getSupabaseClient(), [])

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
      const { error } = await supabase
        .from('groups')
        .update({ status: 'deleted' })
        .eq('id', groupId)

      if (error) throw error

      setGroups(groups.filter(g => g.id !== groupId))
      setError(null)
    } catch (error) {
      console.error('Error deleting group:', error)
      setError('Failed to delete group')
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

function PlansTab() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<any[]>([])
  const [availableGroups, setAvailableGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Use singleton client to prevent per-render creation
  const supabase = useMemo(() => getSupabaseClient(), [])

  useEffect(() => {
    if (user) {
      loadPlans()
      loadGroups()
    }
  }, [user])

  const loadPlans = async () => {
    try {
      setLoading(true)
      const { data: plans, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setPlans(plans || [])
      setError(null)
    } catch (error) {
      console.error('Error loading plans:', error)
      setError('Failed to load plans')
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
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

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
      const { error } = await supabase
        .from('meal_plans')
        .update({ status: 'deleted' })
        .eq('id', planId)

      if (error) throw error

      setPlans(plans.filter(p => p.id !== planId))
      setError(null)
    } catch (error) {
      console.error('Error deleting plan:', error)
      setError('Failed to delete plan')
    }
  }

  const handleCancelForm = () => {
    setShowCreateForm(false)
    setEditingPlan(null)
    setError(null)
  }

  const getGroupMealsSummary = (plan: any) => {
    if (!plan.group_meals || plan.group_meals.length === 0) {
      // Fallback for plans without group_meals data
      return []
    }

    // Map the stored group_meals to display format
    return plan.group_meals.map((groupMeal: any) => {
      const group = availableGroups.find(g => g.id === groupMeal.group_id)
      return {
        name: group?.name || `Group ${groupMeal.group_id}`,
        mealCount: groupMeal.meal_count,
        notes: groupMeal.notes || ''
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                No groups available
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>You need to create at least one group before you can create meal plans. Groups define who the meals are for and any dietary restrictions.</p>
              </div>
            </div>
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
      ) : plans.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-700">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No meal plans</h3>
              <p className="mt-1 text-sm text-gray-800">
                Get started by creating your first meal plan.
              </p>
              <div className="mt-6">
                <button 
                  onClick={() => setShowCreateForm(true)}
                  disabled={noGroupsAvailable}
                  className={`font-bold py-2 px-4 rounded ${
                    noGroupsAvailable
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-700 text-white'
                  }`}
                >
                  {noGroupsAvailable ? 'Create Group First' : 'Create Plan'}
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
                            {groupMealsSummary.map((groupDetail, index) => (
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
                      </div>
                      
                      {plan.notes && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-600">
                            <span className="mr-2">📝</span>
                            <span className="font-medium">Plan Notes:</span> {plan.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => setEditingPlan(plan)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded mr-2"
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
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}