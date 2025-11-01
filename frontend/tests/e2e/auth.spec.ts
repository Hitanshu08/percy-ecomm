/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the auth page before each test
    await page.goto('/auth');
  });

  test('should display login form', async ({ page }) => {
    // Check if login form elements are present
    await expect(page.getByText('Login')).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('should allow user to input credentials', async ({ page }) => {
    // Fill in the login form
    await page.getByPlaceholder('Username').fill('testuser');
    await page.getByPlaceholder('Password').fill('testpassword');
    
    // Verify the values are set
    await expect(page.getByPlaceholder('Username')).toHaveValue('testuser');
    await expect(page.getByPlaceholder('Password')).toHaveValue('testpassword');
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('Password');
    const toggleButton = page.getByRole('button', { name: /toggle password visibility/i });
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle button
    await toggleButton.click();
    
    // Password should be visible
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click toggle button again
    await toggleButton.click();
    
    // Password should be hidden again
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should switch to signup form', async ({ page }) => {
    // Click on signup tab/link
    await page.getByText('Sign Up').click();
    
    // Check if signup form elements are present
    await expect(page.getByText('Sign Up')).toBeVisible();
    await expect(page.getByPlaceholder('Full Name')).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });

  test('should switch to forgot password form', async ({ page }) => {
    // Click on forgot password link
    await page.getByText('Forgot Password?').click();
    
    // Check if forgot password form elements are present
    await expect(page.getByText('Reset Password')).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset email/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /login/i }).click();
    
    // Check for validation messages (if implemented)
    // This depends on your validation implementation
  });

  test('should handle successful login', async ({ page }) => {
    // Mock successful login response
    await page.route('/api/v1/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          token_type: 'bearer'
        })
      });
    });

    // Fill in valid credentials
    await page.getByPlaceholder('Username').fill('testuser');
    await page.getByPlaceholder('Password').fill('testpassword');
    
    // Submit the form
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle login failure', async ({ page }) => {
    // Mock failed login response
    await page.route('/api/v1/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Invalid credentials'
        })
      });
    });

    // Fill in invalid credentials
    await page.getByPlaceholder('Username').fill('wronguser');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    
    // Submit the form
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('should handle successful signup', async ({ page }) => {
    // Mock successful signup response
    await page.route('/api/v1/signup', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'User created successfully'
        })
      });
    });

    // Switch to signup form
    await page.getByText('Sign Up').click();
    
    // Fill in signup form
    await page.getByPlaceholder('Full Name').fill('Test User');
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Username').fill('testuser');
    await page.getByPlaceholder('Password').fill('testpassword123');
    
    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should show success message or redirect
    await expect(page.getByText(/user created successfully/i)).toBeVisible();
  });

  test('should handle signup with existing username', async ({ page }) => {
    // Mock failed signup response
    await page.route('/api/v1/signup', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Username already exists'
        })
      });
    });

    // Switch to signup form
    await page.getByText('Sign Up').click();
    
    // Fill in signup form with existing username
    await page.getByPlaceholder('Full Name').fill('Test User');
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Username').fill('existinguser');
    await page.getByPlaceholder('Password').fill('testpassword123');
    
    // Submit the form
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should show error message
    await expect(page.getByText(/username already exists/i)).toBeVisible();
  });
});

*/
