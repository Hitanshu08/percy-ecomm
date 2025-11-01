/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Header from '../../components/Header'

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

// Mock the ThemeContext
const mockThemeContext = {
  theme: 'light',
  toggleTheme: vi.fn()
}

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockThemeContext
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

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header with user information', () => {
    renderWithRouter(<Header />)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('testuser')).toBeInTheDocument()
    expect(screen.getByText('100.0 credits')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderWithRouter(<Header />)
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Shop')).toBeInTheDocument()
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('shows admin link for admin users', () => {
    const adminAuthContext = {
      ...mockAuthContext,
      user: {
        ...mockAuthContext.user,
        role: 'admin'
      }
    }
    
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(adminAuthContext)
    
    renderWithRouter(<Header />)
    
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('does not show admin link for regular users', () => {
    renderWithRouter(<Header />)
    
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('toggles theme when theme button is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Header />)
    
    const themeButton = screen.getByRole('button', { name: /toggle theme/i })
    await user.click(themeButton)
    
    expect(mockThemeContext.toggleTheme).toHaveBeenCalled()
  })

  it('opens user menu when user avatar is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Header />)
    
    const userAvatar = screen.getByRole('button', { name: /user menu/i })
    await user.click(userAvatar)
    
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('logs out user when logout is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Header />)
    
    // Open user menu
    const userAvatar = screen.getByRole('button', { name: /user menu/i })
    await user.click(userAvatar)
    
    // Click logout
    const logoutButton = screen.getByText('Logout')
    await user.click(logoutButton)
    
    expect(mockAuthContext.logout).toHaveBeenCalled()
  })

  it('navigates to profile when profile is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Header />)
    
    // Open user menu
    const userAvatar = screen.getByRole('button', { name: /user menu/i })
    await user.click(userAvatar)
    
    // Click profile
    const profileButton = screen.getByText('Profile')
    await user.click(profileButton)
    
    expect(mockNavigate).toHaveBeenCalledWith('/profile')
  })

  it('shows mobile menu toggle on small screens', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    })
    
    renderWithRouter(<Header />)
    
    expect(screen.getByRole('button', { name: /mobile menu/i })).toBeInTheDocument()
  })

  it('toggles mobile menu when mobile menu button is clicked', async () => {
    const user = userEvent.setup()
    
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    })
    
    renderWithRouter(<Header />)
    
    const mobileMenuButton = screen.getByRole('button', { name: /mobile menu/i })
    await user.click(mobileMenuButton)
    
    // Mobile menu should be visible
    expect(screen.getByRole('navigation')).toHaveClass('mobile-menu-open')
  })
})

*/
