'use client'

import React from 'react'
import { StoredGeneratedMeal } from '@/lib/mockStorage'

interface MealCardProps {
  meal: StoredGeneratedMeal
  onSelect?: (mealId: string, selected: boolean) => void
  showSelection?: boolean
  compact?: boolean
}

export default function MealCard({ 
  meal, 
  onSelect, 
  showSelection = true,
  compact = false 
}: MealCardProps) {
  const handleSelectionChange = () => {
    if (onSelect) {
      onSelect(meal.id, !meal.selected)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }

  if (compact) {
    return (
      <div className={`border rounded-lg p-4 transition-all ${
        meal.selected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-300 bg-white hover:border-gray-400'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">{meal.title}</h3>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{meal.description}</p>
            
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <span>⏱ {formatTime(meal.total_time)}</span>
              <span>👥 {meal.servings} servings</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(meal.difficulty)}`}>
                {meal.difficulty}
              </span>
            </div>
          </div>
          
          {showSelection && onSelect && (
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={handleSelectionChange}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  meal.selected
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-gray-300 hover:border-blue-500'
                }`}
              >
                {meal.selected && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      meal.selected 
        ? 'border-blue-500 bg-blue-50 shadow-lg' 
        : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-md'
    }`}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">{meal.title}</h3>
            <p className="text-gray-600 mt-2">{meal.description}</p>
            
            {/* Time and Difficulty Info */}
            <div className="flex items-center space-x-6 mt-4">
              <div className="flex items-center text-sm text-gray-500">
                <span className="mr-2">🍳</span>
                <span>Prep: {formatTime(meal.prep_time)}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <span className="mr-2">🔥</span>
                <span>Cook: {formatTime(meal.cook_time)}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <span className="mr-2">⏱</span>
                <span>Total: {formatTime(meal.total_time)}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <span className="mr-2">👥</span>
                <span>{meal.servings} servings</span>
              </div>
            </div>

            {/* Difficulty and Dietary Tags */}
            <div className="flex items-center space-x-2 mt-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(meal.difficulty)}`}>
                {meal.difficulty}
              </span>
              {meal.dietary_info.map((diet, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                >
                  {diet}
                </span>
              ))}
            </div>

            {/* Tags */}
            {meal.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {meal.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {showSelection && onSelect && (
            <div className="ml-6 flex-shrink-0">
              <button
                onClick={handleSelectionChange}
                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                  meal.selected
                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                    : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                {meal.selected ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-3 h-3 rounded-full border-2 border-current"></div>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ingredients Section */}
      <div className="border-t border-gray-200 px-6 py-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Ingredients ({meal.ingredients.length})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {meal.ingredients.slice(0, 6).map((ingredient, index) => (
            <div key={index} className="flex items-center text-sm text-gray-600">
              <span className="mr-2">•</span>
              <span>{ingredient.amount} {ingredient.unit} {ingredient.name}</span>
            </div>
          ))}
          {meal.ingredients.length > 6 && (
            <div className="text-sm text-gray-500 italic">
              +{meal.ingredients.length - 6} more ingredients...
            </div>
          )}
        </div>
      </div>

      {/* Instructions Preview */}
      <div className="border-t border-gray-200 px-6 py-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Instructions ({meal.instructions.length} steps)</h4>
        <div className="space-y-2">
          {meal.instructions.slice(0, 3).map((instruction, index) => (
            <div key={index} className="flex text-sm text-gray-600">
              <span className="mr-3 text-blue-500 font-medium">{index + 1}.</span>
              <span className="line-clamp-2">{instruction}</span>
            </div>
          ))}
          {meal.instructions.length > 3 && (
            <div className="text-sm text-gray-500 italic">
              +{meal.instructions.length - 3} more steps...
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Generated for: {meal.group_id}</span>
          <span>Created: {new Date(meal.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}