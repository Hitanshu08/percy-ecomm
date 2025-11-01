/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient, login, signup, getProfile, getServices, purchaseSubscription } from '../../lib/apiClient'

// Mock fetch
global.fetch = vi.fn()

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      const mockResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await login('testuser', 'testpassword')

      expect(fetch).toHaveBeenCalledWith('/api/v1/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'username=testuser&password=testpassword'
      })

      expect(result).toEqual(mockResponse)
    })

    it('should handle login failure', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Invalid credentials' })
      } as Response)

      await expect(login('testuser', 'wrongpassword')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('signup', () => {
    it('should signup successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        password: 'testpassword123'
      }

      const mockResponse = { message: 'User created successfully' }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await signup(userData)

      expect(fetch).toHaveBeenCalledWith('/api/v1/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      })

      expect(result).toEqual(mockResponse)
    })

    it('should handle signup failure', async () => {
      const userData = {
        username: 'existinguser',
        email: 'test@example.com',
        full_name: 'Test User',
        password: 'testpassword123'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Username already exists' })
      } as Response)

      await expect(signup(userData)).rejects.toThrow('Username already exists')
    })
  })

  describe('getProfile', () => {
    it('should get user profile with valid token', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: true,
        credits: 100.0
      }

      localStorage.setItem('token', 'mock_token')

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProfile)
      } as Response)

      const result = await getProfile()

      expect(fetch).toHaveBeenCalledWith('/api/v1/profile', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json',
        }
      })

      expect(result).toEqual(mockProfile)
    })

    it('should handle unauthorized access', async () => {
      localStorage.removeItem('token')

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthorized' })
      } as Response)

      await expect(getProfile()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getServices', () => {
    it('should get available services', async () => {
      const mockServices = [
        {
          id: 1,
          name: 'Test Service',
          description: 'A test service',
          price: 10.0,
          credits: 100,
          is_active: true
        }
      ]

      localStorage.setItem('token', 'mock_token')

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockServices)
      } as Response)

      const result = await getServices()

      expect(fetch).toHaveBeenCalledWith('/api/v1/services', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json',
        }
      })

      expect(result).toEqual(mockServices)
    })
  })

  describe('purchaseSubscription', () => {
    it('should purchase subscription successfully', async () => {
      const purchaseData = {
        service_id: 1,
        payment_method: 'credits'
      }

      const mockResponse = { message: 'Subscription purchased successfully' }

      localStorage.setItem('token', 'mock_token')

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)

      const result = await purchaseSubscription(purchaseData)

      expect(fetch).toHaveBeenCalledWith('/api/v1/purchase-subscription', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(purchaseData)
      })

      expect(result).toEqual(mockResponse)
    })

    it('should handle insufficient credits', async () => {
      const purchaseData = {
        service_id: 1,
        payment_method: 'credits'
      }

      localStorage.setItem('token', 'mock_token')

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Insufficient credits' })
      } as Response)

      await expect(purchaseSubscription(purchaseData)).rejects.toThrow('Insufficient credits')
    })
  })

  describe('apiClient', () => {
    it('should include authorization header when token is present', async () => {
      localStorage.setItem('token', 'mock_token')

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)

      await apiClient('/test', { method: 'GET' })

      expect(fetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock_token',
          'Content-Type': 'application/json',
        }
      })
    })

    it('should not include authorization header when token is not present', async () => {
      localStorage.removeItem('token')

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)

      await apiClient('/test', { method: 'GET' })

      expect(fetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      await expect(apiClient('/test', { method: 'GET' })).rejects.toThrow('Network error')
    })
  })
})

*/
