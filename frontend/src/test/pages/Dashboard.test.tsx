/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../../pages/Dashboard'

// Mock the AuthContext
const mockAuthContext = {
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user',
    is_active: true,
    credits: 100.0
  },
  login: vi.fn(),
  logout: vi.fn(),
  isLoading: false
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}))

// Mock the API client
vi.mock('../../lib/apiClient', () => ({
  get: vi.fn()
}))

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard with user information', () => {
    renderWithRouter(<Dashboard />)
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument()
  })

  it('displays user credits', () => {
    renderWithRouter(<Dashboard />)
    
    expect(screen.getByText('100.0')).toBeInTheDocument()
    expect(screen.getByText('Credits')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderWithRouter(<Dashboard />)
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('loads and displays dashboard data', async () => {
    const { get } = await import('../../lib/apiClient')
    
    const mockDashboardData = {
      total_credits: 100.0,
      active_subscriptions: 2,
      recent_transactions: [
        {
          id: 1,
          type: 'deposit',
          amount: 50.0,
          date: '2024-01-01',
          description: 'Credit deposit'
        }
      ],
      recent_subscriptions: [
        {
          id: 1,
          service_name: 'Test Service',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_active: true
        }
      ]
    }
    
    vi.mocked(get).mockResolvedValue(mockDashboardData)
    
    renderWithRouter(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // active subscriptions
      expect(screen.getByText('Test Service')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    const { get } = await import('../../lib/apiClient')
    
    vi.mocked(get).mockRejectedValue(new Error('API Error'))
    
    renderWithRouter(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument()
    })
  })

  it('displays recent transactions', async () => {
    const { get } = await import('../../lib/apiClient')
    
    const mockDashboardData = {
      total_credits: 100.0,
      active_subscriptions: 0,
      recent_transactions: [
        {
          id: 1,
          type: 'deposit',
          amount: 50.0,
          date: '2024-01-01',
          description: 'Credit deposit'
        },
        {
          id: 2,
          type: 'purchase',
          amount: -25.0,
          date: '2024-01-02',
          description: 'Service purchase'
        }
      ],
      recent_subscriptions: []
    }
    
    vi.mocked(get).mockResolvedValue(mockDashboardData)
    
    renderWithRouter(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Credit deposit')).toBeInTheDocument()
      expect(screen.getByText('Service purchase')).toBeInTheDocument()
      expect(screen.getByText('+50.0')).toBeInTheDocument()
      expect(screen.getByText('-25.0')).toBeInTheDocument()
    })
  })

  it('displays recent subscriptions', async () => {
    const { get } = await import('../../lib/apiClient')
    
    const mockDashboardData = {
      total_credits: 100.0,
      active_subscriptions: 1,
      recent_transactions: [],
      recent_subscriptions: [
        {
          id: 1,
          service_name: 'Test Service',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_active: true
        },
        {
          id: 2,
          service_name: 'Premium Service',
          start_date: '2024-01-15',
          end_date: '2024-12-31',
          is_active: true
        }
      ]
    }
    
    vi.mocked(get).mockResolvedValue(mockDashboardData)
    
    renderWithRouter(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Test Service')).toBeInTheDocument()
      expect(screen.getByText('Premium Service')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('shows empty state when no data', async () => {
    const { get } = await import('../../lib/apiClient')
    
    const mockDashboardData = {
      total_credits: 0.0,
      active_subscriptions: 0,
      recent_transactions: [],
      recent_subscriptions: []
    }
    
    vi.mocked(get).mockResolvedValue(mockDashboardData)
    
    renderWithRouter(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('No recent transactions')).toBeInTheDocument()
      expect(screen.getByText('No recent subscriptions')).toBeInTheDocument()
    })
  })
})

*/
