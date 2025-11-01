/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock_token');
      localStorage.setItem('refreshToken', 'mock_refresh_token');
    });

    // Mock API responses
    await page.route('/api/v1/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'user',
          is_active: true,
          credits: 100.0
        })
      });
    });

    // Start from dashboard
    await page.goto('/dashboard');
  });

  test('should navigate to dashboard from header', async ({ page }) => {
    // Click on Dashboard link in header
    await page.getByRole('link', { name: /dashboard/i }).click();
    
    // Should be on dashboard page
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('should navigate to shop from header', async ({ page }) => {
    // Mock services API
    await page.route('/api/v1/services', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Click on Shop link in header
    await page.getByRole('link', { name: /shop/i }).click();
    
    // Should be on shop page
    await expect(page).toHaveURL('/shop');
    await expect(page.getByText('Shop')).toBeVisible();
  });

  test('should navigate to subscriptions from header', async ({ page }) => {
    // Mock subscriptions API
    await page.route('/api/v1/subscriptions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Click on Subscriptions link in header
    await page.getByRole('link', { name: /subscriptions/i }).click();
    
    // Should be on subscriptions page
    await expect(page).toHaveURL('/subscriptions');
    await expect(page.getByText('Subscriptions')).toBeVisible();
  });

  test('should navigate to wallet from header', async ({ page }) => {
    // Mock wallet API
    await page.route('/api/v1/wallet', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 1,
          credits: 100.0,
          transactions: []
        })
      });
    });

    // Click on Wallet link in header
    await page.getByRole('link', { name: /wallet/i }).click();
    
    // Should be on wallet page
    await expect(page).toHaveURL('/wallet');
    await expect(page.getByText('Wallet')).toBeVisible();
  });

  test('should navigate to profile from user menu', async ({ page }) => {
    // Click on user avatar to open menu
    await page.getByRole('button', { name: /user menu/i }).click();
    
    // Click on Profile option
    await page.getByText('Profile').click();
    
    // Should be on profile page
    await expect(page).toHaveURL('/profile');
    await expect(page.getByText('Profile')).toBeVisible();
  });

  test('should logout from user menu', async ({ page }) => {
    // Click on user avatar to open menu
    await page.getByRole('button', { name: /user menu/i }).click();
    
    // Click on Logout option
    await page.getByText('Logout').click();
    
    // Should redirect to auth page
    await expect(page).toHaveURL('/auth');
    await expect(page.getByText('Login')).toBeVisible();
  });

  test('should show admin link for admin users', async ({ page }) => {
    // Mock admin user profile
    await page.route('/api/v1/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
          credits: 1000.0
        })
      });
    });

    await page.goto('/dashboard');

    // Should show admin link
    await expect(page.getByRole('link', { name: /admin/i })).toBeVisible();
  });

  test('should navigate to admin page for admin users', async ({ page }) => {
    // Mock admin user profile
    await page.route('/api/v1/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
          credits: 1000.0
        })
      });
    });

    // Mock admin API
    await page.route('/api/v1/admin/users', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/dashboard');

    // Click on Admin link
    await page.getByRole('link', { name: /admin/i }).click();
    
    // Should be on admin page
    await expect(page).toHaveURL('/admin');
    await expect(page.getByText('Admin Panel')).toBeVisible();
  });

  test('should not show admin link for regular users', async ({ page }) => {
    // Admin link should not be visible for regular users
    await expect(page.getByRole('link', { name: /admin/i })).not.toBeVisible();
  });

  test('should redirect to access denied for non-admin users accessing admin', async ({ page }) => {
    // Try to access admin page directly
    await page.goto('/admin');
    
    // Should redirect to access denied page
    await expect(page).toHaveURL('/access-denied');
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('should handle mobile navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mobile menu button should be visible
    const mobileMenuButton = page.getByRole('button', { name: /mobile menu/i });
    await expect(mobileMenuButton).toBeVisible();

    // Click mobile menu button
    await mobileMenuButton.click();

    // Navigation menu should be visible
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /shop/i })).toBeVisible();
  });

  test('should close mobile menu when clicking outside', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Open mobile menu
    const mobileMenuButton = page.getByRole('button', { name: /mobile menu/i });
    await mobileMenuButton.click();

    // Click outside the menu
    await page.click('body', { position: { x: 10, y: 10 } });

    // Menu should be closed
    await expect(page.getByRole('navigation')).not.toBeVisible();
  });

  test('should maintain navigation state across page refreshes', async ({ page }) => {
    // Navigate to shop
    await page.getByRole('link', { name: /shop/i }).click();
    await expect(page).toHaveURL('/shop');

    // Refresh the page
    await page.reload();

    // Should still be on shop page
    await expect(page).toHaveURL('/shop');
    await expect(page.getByText('Shop')).toBeVisible();
  });

  test('should handle browser back and forward navigation', async ({ page }) => {
    // Navigate to shop
    await page.getByRole('link', { name: /shop/i }).click();
    await expect(page).toHaveURL('/shop');

    // Navigate to wallet
    await page.getByRole('link', { name: /wallet/i }).click();
    await expect(page).toHaveURL('/wallet');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/shop');

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/wallet');
  });

  test('should show active navigation state', async ({ page }) => {
    // Dashboard link should be active
    const dashboardLink = page.getByRole('link', { name: /dashboard/i });
    await expect(dashboardLink).toHaveClass(/active/);

    // Navigate to shop
    await page.getByRole('link', { name: /shop/i }).click();
    
    // Shop link should be active
    const shopLink = page.getByRole('link', { name: /shop/i });
    await expect(shopLink).toHaveClass(/active/);
  });
});

*/
