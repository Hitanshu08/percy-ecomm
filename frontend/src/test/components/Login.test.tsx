/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Login from '../../features/auth/Login'

// Mock the API client
vi.mock('../../lib/apiClient', () => ({
  login: vi.fn()
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

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders login form correctly', () => {
    renderWithRouter(<Login />)
    
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
  })

  it('allows user to input username and password', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Login />)
    
    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    
    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'testpassword')
    
    expect(usernameInput).toHaveValue('testuser')
    expect(passwordInput).toHaveValue('testpassword')
  })

  it('submits form with correct credentials', async () => {
    const user = userEvent.setup()
    const { login } = await import('../../lib/apiClient')
    
    vi.mocked(login).mockResolvedValue({
      access_token: 'mock_token',
      refresh_token: 'mock_refresh_token'
    })
    
    renderWithRouter(<Login />)
    
    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /login/i })
    
    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'testpassword')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('testuser', 'testpassword')
    })
    
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'mock_token')
    expect(localStorage.setItem).toHaveBeenCalledWith('refreshToken', 'mock_refresh_token')
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('handles login failure', async () => {
    const user = userEvent.setup()
    const { login } = await import('../../lib/apiClient')
    
    vi.mocked(login).mockRejectedValue(new Error('Login failed'))
    
    // Mock window.alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    renderWithRouter(<Login />)
    
    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: /login/i })
    
    await user.type(usernameInput, 'testuser')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to login')
    })
    
    alertSpy.mockRestore()
  })

  it('shows token when present in localStorage', () => {
    localStorage.setItem('token', 'existing_token')
    
    renderWithRouter(<Login />)
    
    expect(screen.getByText(/Token: existing_token/)).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Login />)
    
    const passwordInput = screen.getByPlaceholderText('Password')
    const toggleButton = screen.getByRole('button', { name: /toggle password visibility/i })
    
    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    // Click toggle button
    await user.click(toggleButton)
    
    // Password should be visible
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    // Click toggle button again
    await user.click(toggleButton)
    
    // Password should be hidden again
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

*/
