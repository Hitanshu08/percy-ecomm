/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/auth/ProtectedRoute'

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

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const TestComponent = () => <div>Protected Content</div>
const AuthPage = () => <div>Auth Page</div>

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/protected" element={
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders protected content when user is authenticated', () => {
    renderWithRouter(<div />)
    
    // Navigate to protected route
    window.history.pushState({}, '', '/protected')
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to auth page when user is not authenticated', () => {
    const unauthenticatedContext = {
      ...mockAuthContext,
      user: null
    }
    
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(unauthenticatedContext)
    
    renderWithRouter(<div />)
    
    // Navigate to protected route
    window.history.pushState({}, '', '/protected')
    
    expect(mockNavigate).toHaveBeenCalledWith('/auth')
  })

  it('shows loading state when authentication is in progress', () => {
    const loadingContext = {
      ...mockAuthContext,
      isLoading: true
    }
    
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(loadingContext)
    
    renderWithRouter(<div />)
    
    // Navigate to protected route
    window.history.pushState({}, '', '/protected')
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders children when user is authenticated and not loading', () => {
    const authenticatedContext = {
      ...mockAuthContext,
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: true,
        credits: 100.0
      },
      isLoading: false
    }
    
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(authenticatedContext)
    
    renderWithRouter(<div />)
    
    // Navigate to protected route
    window.history.pushState({}, '', '/protected')
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('handles user with inactive status', () => {
    const inactiveUserContext = {
      ...mockAuthContext,
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: false,
        credits: 100.0
      }
    }
    
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(inactiveUserContext)
    
    renderWithRouter(<div />)
    
    // Navigate to protected route
    window.history.pushState({}, '', '/protected')
    
    expect(mockNavigate).toHaveBeenCalledWith('/auth')
  })
})

*/
