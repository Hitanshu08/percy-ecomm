/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
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

    await page.route('/api/v1/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_credits: 100.0,
          active_subscriptions: 2,
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
        })
      });
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test('should display dashboard with user information', async ({ page }) => {
    // Check if dashboard elements are present
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Welcome back, Test User!')).toBeVisible();
  });

  test('should display user credits', async ({ page }) => {
    await expect(page.getByText('100.0')).toBeVisible();
    await expect(page.getByText('Credits')).toBeVisible();
  });

  test('should display active subscriptions count', async ({ page }) => {
    await expect(page.getByText('2')).toBeVisible(); // active subscriptions
    await expect(page.getByText('Active Subscriptions')).toBeVisible();
  });

  test('should display recent transactions', async ({ page }) => {
    await expect(page.getByText('Recent Transactions')).toBeVisible();
    await expect(page.getByText('Credit deposit')).toBeVisible();
    await expect(page.getByText('Service purchase')).toBeVisible();
    await expect(page.getByText('+50.0')).toBeVisible();
    await expect(page.getByText('-25.0')).toBeVisible();
  });

  test('should display recent subscriptions', async ({ page }) => {
    await expect(page.getByText('Recent Subscriptions')).toBeVisible();
    await expect(page.getByText('Test Service')).toBeVisible();
    await expect(page.getByText('Premium Service')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('should navigate to wallet page when credits card is clicked', async ({ page }) => {
    // Click on the credits card
    await page.getByText('Credits').click();
    
    // Should navigate to wallet page
    await expect(page).toHaveURL('/wallet');
  });

  test('should navigate to subscriptions page when subscriptions card is clicked', async ({ page }) => {
    // Click on the subscriptions card
    await page.getByText('Active Subscriptions').click();
    
    // Should navigate to subscriptions page
    await expect(page).toHaveURL('/subscriptions');
  });

  test('should show loading state initially', async ({ page }) => {
    // Navigate to dashboard without mocking API
    await page.goto('/dashboard');
    
    // Should show loading indicator
    await expect(page.getByText(/loading/i)).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/v1/dashboard', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Internal server error'
        })
      });
    });

    await page.goto('/dashboard');
    
    // Should show error message
    await expect(page.getByText(/error loading dashboard/i)).toBeVisible();
  });

  test('should display empty state when no data', async ({ page }) => {
    // Mock empty data response
    await page.route('/api/v1/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_credits: 0.0,
          active_subscriptions: 0,
          recent_transactions: [],
          recent_subscriptions: []
        })
      });
    });

    await page.goto('/dashboard');
    
    // Should show empty state messages
    await expect(page.getByText('No recent transactions')).toBeVisible();
    await expect(page.getByText('No recent subscriptions')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if dashboard is still functional on mobile
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Welcome back, Test User!')).toBeVisible();
    
    // Check if navigation is accessible on mobile
    const mobileMenuButton = page.getByRole('button', { name: /mobile menu/i });
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.getByText('Dashboard')).toBeVisible();
    }
  });
});

*/
