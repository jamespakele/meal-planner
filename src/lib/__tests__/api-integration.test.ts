/**
 * API Integration Tests for Meal Generation System
 * 
 * These tests verify:
 * 1. OpenAI API integration works correctly
 * 2. Mock mode functions properly in development
 * 3. Error handling for API failures
 * 4. Response parsing and validation
 * 5. Environment variable configuration
 */

import {
  generateMealsWithChatGPT,
  generateMealsWithCombinedChatGPT,
  generateMealsForPlan,
  validateGeneratedMeal,
  ChatGPTMealRequest,
  CombinedChatGPTMealRequest,
  MEAL_GENERATION_CONFIG
} from '../mealGenerator'
import { PlanData } from '../planValidation'
import { StoredGroup } from '../mockStorage'

// Mock fetch globally for testing
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('API Integration for Meal Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables for each test
    delete process.env.OPENAI_API_KEY
    delete process.env.NEXT_PUBLIC_OPENAI_API_KEY
  })

  describe('OpenAI API Integration', () => {
    const mockChatGPTRequest: ChatGPTMealRequest = {
      group_name: 'Test Family',
      demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
      dietary_restrictions: ['vegetarian', 'nut-free'],
      meals_to_generate: 3,
      group_notes: 'Family loves pasta dishes',
      week_start: '2024-12-01',
      adult_equivalent: 4.6
    }

    describe('Successful API calls', () => {
      it('should generate meals successfully with valid API key', async () => {
        // Set up environment
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        // Mock successful API response
        const mockApiResponse = {
          meals: [
            {
              title: 'Vegetarian Pasta Primavera',
              description: 'Fresh seasonal vegetables with pasta',
              prep_time: 15,
              cook_time: 20,
              servings: 4,
              ingredients: [
                { name: 'penne pasta', amount: 1, unit: 'lb', category: 'grains' },
                { name: 'bell peppers', amount: 2, unit: 'medium', category: 'vegetables' }
              ],
              instructions: ['Cook pasta according to package directions', 'Sauté vegetables'],
              tags: ['vegetarian', 'quick'],
              dietary_info: ['vegetarian', 'nut-free'],
              difficulty: 'easy'
            }
          ]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{
              message: {
                content: JSON.stringify(mockApiResponse)
              }
            }]
          })
        })

        const result = await generateMealsWithChatGPT(mockChatGPTRequest)

        expect(result).toHaveLength(1)
        expect(result[0].title).toBe('Vegetarian Pasta Primavera')
        expect(result[0].dietary_info).toContain('vegetarian')
        expect(result[0].dietary_info).toContain('nut-free')
        expect(result[0].group_id).toBe('Test Family')
        
        // Verify API was called with correct parameters
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer sk-test-key'
            },
            body: expect.stringContaining('Test Family')
          })
        )
      })

      it('should respect dietary restrictions in prompt', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        const mockApiResponse = { meals: [] }
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify(mockApiResponse) } }]
          })
        })

        // Expect it to fail with empty meals array, but we can check the prompt was sent correctly
        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('No valid meals were generated')

        const callArgs = mockFetch.mock.calls[0][1]
        const requestBody = JSON.parse(callArgs.body)
        const prompt = requestBody.messages[1].content

        expect(prompt).toContain('No meat, poultry, or fish') // vegetarian restriction
        expect(prompt).toContain('No tree nuts or peanuts') // nut-free restriction
      })

      it('should include demographics in prompt', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        const mockApiResponse = { meals: [] }
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify(mockApiResponse) } }]
          })
        })

        // Expect it to fail with empty meals array, but we can check the prompt was sent correctly
        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('No valid meals were generated')

        const callArgs = mockFetch.mock.calls[0][1]
        const requestBody = JSON.parse(callArgs.body)
        const prompt = requestBody.messages[1].content

        expect(prompt).toContain('2 adults, 1 teens, 2 kids, 0 toddlers')
        expect(prompt).toContain('4.6 adult equivalent')
      })
    })

    describe('API error handling', () => {
      it('should handle 401 Unauthorized (invalid API key)', async () => {
        process.env.OPENAI_API_KEY = 'invalid-key'
        
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })

        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('ChatGPT API error: 401 Unauthorized')
      })

      it('should handle 429 Rate Limit Exceeded', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        })

        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('ChatGPT API error: 429 Too Many Requests')
      })

      it('should handle network timeout', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        // Mock timeout by rejecting after timeout period
        mockFetch.mockImplementationOnce(() => 
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('aborted')), 100)
          })
        )

        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('Request timed out')
      })

      it('should handle malformed JSON response', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{
              message: {
                content: 'This is not valid JSON}'
              }
            }]
          })
        })

        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('Failed to parse ChatGPT response as JSON')
      })

      it('should handle response without choices', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            // Missing choices array
            usage: { total_tokens: 100 }
          })
        })

        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('No content received from ChatGPT API')
      })

      it('should handle truncated response', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        // Create a truncated JSON response (starts but doesn't end properly)
        const truncatedResponse = '{"meals": [{"title": "Test Meal", "description": "This response was cut off mid-'
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{
              message: {
                content: truncatedResponse
              }
            }]
          })
        })

        await expect(generateMealsWithChatGPT(mockChatGPTRequest))
          .rejects.toThrow('ChatGPT response appears to be truncated')
      })
    })

    describe('Response parsing and validation', () => {
      it('should clean and parse response with extra text', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        // Mock response with markdown and extra text
        const responseWithExtraText = `
        Here are the meal suggestions:
        \`\`\`json
        {
          "meals": [
            {
              "title": "Test Meal",
              "description": "A test meal",
              "prep_time": 15,
              "cook_time": 20,
              "servings": 4,
              "ingredients": [{"name": "test", "amount": 1, "unit": "cup", "category": "other"}],
              "instructions": ["Do something"],
              "tags": ["test"],
              "dietary_info": [],
              "difficulty": "easy"
            }
          ]
        }
        \`\`\`
        
        These meals should work well for your family!
        `
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{
              message: {
                content: responseWithExtraText
              }
            }]
          })
        })

        const result = await generateMealsWithChatGPT(mockChatGPTRequest)
        expect(result).toHaveLength(1)
        expect(result[0].title).toBe('Test Meal')
      })

      it('should filter out invalid meals', async () => {
        process.env.OPENAI_API_KEY = 'sk-test-key'
        
        const mixedResponse = {
          meals: [
            {
              title: 'Valid Meal',
              description: 'A valid meal',
              prep_time: 15,
              cook_time: 20,
              servings: 4,
              ingredients: [{"name": "test", "amount": 1, "unit": "cup", "category": "other"}],
              instructions: ['Do something'],
              tags: ['test'],
              dietary_info: [],
              difficulty: 'easy'
            },
            {
              title: 'Invalid Meal',
              // Missing required fields like prep_time, cook_time, etc.
              description: 'This meal is missing required fields'
            },
            {
              title: 'Another Valid Meal',
              description: 'Another valid meal',
              prep_time: 10,
              cook_time: 15,
              servings: 4,
              ingredients: [{"name": "test2", "amount": 2, "unit": "tbsp", "category": "other"}],
              instructions: ['Do another thing'],
              tags: ['test'],
              dietary_info: [],
              difficulty: 'medium'
            }
          ]
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            choices: [{
              message: {
                content: JSON.stringify(mixedResponse)
              }
            }]
          })
        })

        const result = await generateMealsWithChatGPT(mockChatGPTRequest)
        // Should only return the 2 valid meals
        expect(result).toHaveLength(2)
        expect(result[0].title).toBe('Valid Meal')
        expect(result[1].title).toBe('Another Valid Meal')
      })
    })
  })

  describe('Mock Mode (Development)', () => {
    beforeEach(() => {
      // Set development mode without API key
      process.env.NODE_ENV = 'development'
      delete process.env.OPENAI_API_KEY
    })

    afterEach(() => {
      delete process.env.NODE_ENV
    })

    it('should use mock data in development without API key', async () => {
      const mockCombinedRequest: CombinedChatGPTMealRequest = {
        plan_name: 'Test Plan',
        week_start: '2024-12-01',
        groups: [
          {
            group_name: 'Family Group',
            demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
            dietary_restrictions: ['vegetarian'],
            meals_to_generate: 2,
            adult_equivalent: 4.6
          },
          {
            group_name: 'Adults Only',
            demographics: { adults: 2, teens: 0, kids: 0, toddlers: 0 },
            dietary_restrictions: ['gluten-free'],
            meals_to_generate: 1,
            adult_equivalent: 2.0
          }
        ]
      }
      
      const result = await generateMealsWithCombinedChatGPT(mockCombinedRequest)
      
      expect(mockFetch).not.toHaveBeenCalled() // Should not call real API
      expect(Object.keys(result)).toHaveLength(2)
      
      // Should return mock meals for each group
      expect(result['Family Group']).toBeDefined()
      expect(result['Adults Only']).toBeDefined()
      expect(result['Family Group'].length).toBeGreaterThan(0)
      expect(result['Adults Only'].length).toBeGreaterThan(0)
    })

    it('should generate correct number of mock meals', async () => {
      const mockCombinedRequest: CombinedChatGPTMealRequest = {
        plan_name: 'Test Plan',
        week_start: '2024-12-01',
        groups: [
          {
            group_name: 'Family Group',
            demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
            dietary_restrictions: ['vegetarian'],
            meals_to_generate: 2,
            adult_equivalent: 4.6
          },
          {
            group_name: 'Adults Only',
            demographics: { adults: 2, teens: 0, kids: 0, toddlers: 0 },
            dietary_restrictions: ['gluten-free'],
            meals_to_generate: 1,
            adult_equivalent: 2.0
          }
        ]
      }
      
      const result = await generateMealsWithCombinedChatGPT(mockCombinedRequest)
      
      expect(result['Family Group']).toHaveLength(2) // matches meals_to_generate
      expect(result['Adults Only']).toHaveLength(1) // matches meals_to_generate
    })

    it('should include dietary restrictions in mock meals', async () => {
      const mockCombinedRequest: CombinedChatGPTMealRequest = {
        plan_name: 'Test Plan',
        week_start: '2024-12-01',
        groups: [
          {
            group_name: 'Family Group',
            demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
            dietary_restrictions: ['vegetarian'],
            meals_to_generate: 2,
            adult_equivalent: 4.6
          },
          {
            group_name: 'Adults Only',
            demographics: { adults: 2, teens: 0, kids: 0, toddlers: 0 },
            dietary_restrictions: ['gluten-free'],
            meals_to_generate: 1,
            adult_equivalent: 2.0
          }
        ]
      }
      
      const result = await generateMealsWithCombinedChatGPT(mockCombinedRequest)
      
      const familyMeals = result['Family Group']
      const adultMeals = result['Adults Only']
      
      // Family group has vegetarian restriction
      familyMeals.forEach(meal => {
        expect(meal.dietary_info).toContain('vegetarian')
      })
      
      // Adults group has gluten-free restriction  
      adultMeals.forEach(meal => {
        expect(meal.dietary_info).toContain('gluten-free')
      })
    })
  })

  describe('Environment Configuration', () => {
    it('should prioritize OPENAI_API_KEY over NEXT_PUBLIC_OPENAI_API_KEY', async () => {
      process.env.OPENAI_API_KEY = 'primary-key'
      process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'secondary-key'
      
      const mockResponse = { meals: [] }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }]
        })
      })

      const mockChatGPTRequest: ChatGPTMealRequest = {
        group_name: 'Test Family',
        demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
        dietary_restrictions: ['vegetarian', 'nut-free'],
        meals_to_generate: 3,
        group_notes: 'Family loves pasta dishes',
        week_start: '2024-12-01',
        adult_equivalent: 4.6
      }

      // Expect it to fail with empty meals, but we can verify the API key was used correctly
      await expect(generateMealsWithChatGPT(mockChatGPTRequest))
        .rejects.toThrow('No valid meals were generated')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer primary-key'
          })
        })
      )
    })

    it('should fall back to NEXT_PUBLIC_OPENAI_API_KEY if OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY
      process.env.NEXT_PUBLIC_OPENAI_API_KEY = 'fallback-key'
      
      const mockResponse = { meals: [] }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }]
        })
      })

      const mockChatGPTRequest: ChatGPTMealRequest = {
        group_name: 'Test Family',
        demographics: { adults: 2, teens: 1, kids: 2, toddlers: 0 },
        dietary_restrictions: ['vegetarian', 'nut-free'],
        meals_to_generate: 3,
        group_notes: 'Family loves pasta dishes',
        week_start: '2024-12-01',
        adult_equivalent: 4.6
      }

      // Expect it to fail with empty meals, but we can verify the fallback API key was used
      await expect(generateMealsWithChatGPT(mockChatGPTRequest))
        .rejects.toThrow('No valid meals were generated')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer fallback-key'
          })
        })
      )
    })

    it('should use mock mode when no API key is available', async () => {
      delete process.env.OPENAI_API_KEY
      delete process.env.NEXT_PUBLIC_OPENAI_API_KEY
      process.env.NODE_ENV = 'development'
      
      const result = await generateMealsWithCombinedChatGPT({
        plan_name: 'Test',
        week_start: '2024-12-01',
        groups: [
          {
            group_name: 'Test Group',
            demographics: { adults: 2, teens: 0, kids: 0, toddlers: 0 },
            dietary_restrictions: [],
            meals_to_generate: 1,
            adult_equivalent: 2.0
          }
        ]
      })
      
      expect(mockFetch).not.toHaveBeenCalled()
      expect(result['Test Group']).toBeDefined()
      expect(result['Test Group']).toHaveLength(1)
    })
  })
})