/**
 * TDD Component Test for FormLinkManager
 * These tests will FAIL initially due to API failures from database schema mismatch
 * This is intentional for the TDD Red phase
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FormLinkManager from '../FormLinkManager'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('FormLinkManager Component (TDD)', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Clear clipboard API mock
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve()),
      },
    })
  })

  describe('Initial State and Loading', () => {
    it('should render generate button when no links exist', () => {
      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      expect(screen.getByText('Generate Form Links')).toBeInTheDocument()
    })

    it('should check for existing links on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: { links: [] } 
        })
      })

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/forms?plan_id=test-plan')
      })
    })
  })

  describe('Form Link Generation', () => {
    it('should handle successful form link generation', async () => {
      // Mock the API responses
      mockFetch
        .mockResolvedValueOnce({
          // Initial load - no existing links
          ok: true,
          json: () => Promise.resolve({ success: true, data: { links: [] } })
        })
        .mockResolvedValueOnce({
          // Generation request
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              plan_id: 'test-plan',
              links: [
                {
                  role: 'co_manager',
                  url: 'https://app.com/f/cm123abc',
                  shortCode: 'cm123abc',
                  token: 'token1',
                  expires_at: '2025-09-16T00:00:00Z',
                  created_at: '2025-08-16T00:00:00Z',
                  isExpired: false,
                  isActive: true
                },
                {
                  role: 'other',
                  url: 'https://app.com/f/ot456def',
                  shortCode: 'ot456def', 
                  token: 'token2',
                  expires_at: '2025-09-16T00:00:00Z',
                  created_at: '2025-08-16T00:00:00Z',
                  isExpired: false,
                  isActive: true
                }
              ],
              expires_at: '2025-09-16T00:00:00Z',
              instructions: {
                co_manager: 'Your selections will override conflicts',
                other: 'Your input is advisory'
              }
            }
          })
        })

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      // Click generate button
      const generateButton = screen.getByText('Generate Form Links')
      fireEvent.click(generateButton)
      
      // Wait for the links to appear
      await waitFor(() => {
        expect(screen.getByText('Show Form Links')).toBeInTheDocument()
      })
      
      // Click to show the links
      fireEvent.click(screen.getByText('Show Form Links'))
      
      // Check that both links are displayed
      await waitFor(() => {
        expect(screen.getByText('Co-Manager')).toBeInTheDocument()
        expect(screen.getByText('Participant')).toBeInTheDocument()
        expect(screen.getByDisplayValue('https://app.com/f/cm123abc')).toBeInTheDocument()
        expect(screen.getByDisplayValue('https://app.com/f/ot456def')).toBeInTheDocument()
      })
    })

    it('should handle database schema errors gracefully', async () => {
      // This test will FAIL initially because we don't have proper error handling
      
      mockFetch
        .mockResolvedValueOnce({
          // Initial load fails due to schema error
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            success: false,
            error: 'column "revoked_at" does not exist'
          })
        })
        .mockResolvedValueOnce({
          // Generation also fails
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            success: false, 
            error: 'column "revoked_at" does not exist'
          })
        })

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      // Click generate button
      const generateButton = screen.getByText('Generate Form Links')
      fireEvent.click(generateButton)
      
      // Should show a helpful error message about database updates needed
      await waitFor(() => {
        const errorMessage = screen.getByText(/Failed to generate form links/i)
        expect(errorMessage).toBeInTheDocument()
      })
      
      // The error should be user-friendly, not raw database error
      expect(screen.queryByText(/revoked_at/)).not.toBeInTheDocument()
      expect(screen.queryByText(/column.*does not exist/)).not.toBeInTheDocument()
    })

    it('should handle rate limiting errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { links: [] } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({
            success: false,
            error: 'Too many requests'
          })
        })

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      const generateButton = screen.getByText('Generate Form Links')
      fireEvent.click(generateButton)
      
      await waitFor(() => {
        expect(screen.getByText(/too many requests/i)).toBeInTheDocument()
      })
    })
  })

  describe('Link Management Features', () => {
    it('should allow copying links to clipboard', async () => {
      const mockWriteText = navigator.clipboard.writeText as jest.Mock
      
      // Mock existing links
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            links: [{
              role: 'co_manager',
              url: 'https://app.com/f/cm123abc',
              shortCode: 'cm123abc',
              isActive: true
            }]
          }
        })
      })

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      // Wait for existing links to load and show them
      await waitFor(() => {
        fireEvent.click(screen.getByText('Show Form Links'))
      })
      
      // Click copy button
      const copyButton = screen.getByText('Copy')
      fireEvent.click(copyButton)
      
      expect(mockWriteText).toHaveBeenCalledWith('https://app.com/f/cm123abc')
      
      // Should show "Copied!" feedback
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })

    it('should allow revoking links', async () => {
      // Mock existing links and revocation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { links: [{ role: 'co_manager', isActive: true }] }
          })
        })
        .mockResolvedValueOnce({
          // Revocation request
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

      // Mock window.confirm
      window.confirm = jest.fn(() => true)

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Show Form Links'))
      })
      
      const revokeButton = screen.getByText('Revoke')
      fireEvent.click(revokeButton)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/forms?plan_id=test-plan',
          expect.objectContaining({ method: 'DELETE' })
        )
      })
    })
  })

  describe('Error Recovery and User Experience', () => {
    it('should provide retry functionality after errors', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { links: [] } })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ success: false, error: 'Database error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { links: [{ role: 'co_manager' }] }
          })
        })

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      // First attempt fails
      fireEvent.click(screen.getByText('Generate Form Links'))
      
      await waitFor(() => {
        expect(screen.getByText(/failed to generate/i)).toBeInTheDocument()
      })
      
      // Retry should work
      fireEvent.click(screen.getByText('Generate Form Links'))
      
      await waitFor(() => {
        expect(screen.getByText('Show Form Links')).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { links: [] } })
        })
        .mockRejectedValueOnce(new Error('Network error'))

      render(<FormLinkManager planId="test-plan" planName="Test Plan" />)
      
      fireEvent.click(screen.getByText('Generate Form Links'))
      
      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument()
      })
    })
  })
})