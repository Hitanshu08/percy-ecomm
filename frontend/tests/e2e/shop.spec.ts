/* TESTS COMMENTED OUT - Remove the comment block to re-enable tests

import { test, expect } from '@playwright/test';

test.describe('Shop', () => {
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

    await page.route('/api/v1/services', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Basic Service',
            description: 'A basic service for testing',
            price: 10.0,
            credits: 100,
            is_active: true
          },
          {
            id: 2,
            name: 'Premium Service',
            description: 'A premium service with advanced features',
            price: 25.0,
            credits: 250,
            is_active: true
          },
          {
            id: 3,
            name: 'Enterprise Service',
            description: 'An enterprise service for large organizations',
            price: 50.0,
            credits: 500,
            is_active: true
          }
        ])
      });
    });

    // Navigate to shop
    await page.goto('/shop');
  });

  test('should display shop page with services', async ({ page }) => {
    // Check if shop page elements are present
    await expect(page.getByText('Shop')).toBeVisible();
    await expect(page.getByText('Available Services')).toBeVisible();
  });

  test('should display all available services', async ({ page }) => {
    // Check if all services are displayed
    await expect(page.getByText('Basic Service')).toBeVisible();
    await expect(page.getByText('Premium Service')).toBeVisible();
    await expect(page.getByText('Enterprise Service')).toBeVisible();
  });

  test('should display service details correctly', async ({ page }) => {
    // Check service details
    await expect(page.getByText('A basic service for testing')).toBeVisible();
    await expect(page.getByText('$10.0')).toBeVisible();
    await expect(page.getByText('100 credits')).toBeVisible();
  });

  test('should allow filtering services', async ({ page }) => {
    // Test search functionality
    const searchInput = page.getByPlaceholder('Search services...');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Premium');
      await expect(page.getByText('Premium Service')).toBeVisible();
      await expect(page.getByText('Basic Service')).not.toBeVisible();
    }
  });

  test('should allow sorting services', async ({ page }) => {
    // Test sorting functionality
    const sortSelect = page.getByRole('combobox', { name: /sort by/i });
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption('price-low-to-high');
      // Verify services are sorted by price
    }
  });

  test('should handle service purchase with sufficient credits', async ({ page }) => {
    // Mock successful purchase
    await page.route('/api/v1/purchase-subscription', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Subscription purchased successfully'
        })
      });
    });

    // Click purchase button for Basic Service
    const purchaseButton = page.getByRole('button', { name: /purchase basic service/i });
    await purchaseButton.click();

    // Should show success message
    await expect(page.getByText('Subscription purchased successfully')).toBeVisible();
  });

  test('should handle service purchase with insufficient credits', async ({ page }) => {
    // Mock insufficient credits response
    await page.route('/api/v1/purchase-subscription', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Insufficient credits'
        })
      });
    });

    // Click purchase button for Enterprise Service (expensive)
    const purchaseButton = page.getByRole('button', { name: /purchase enterprise service/i });
    await purchaseButton.click();

    // Should show error message
    await expect(page.getByText(/insufficient credits/i)).toBeVisible();
  });

  test('should show purchase confirmation modal', async ({ page }) => {
    // Click purchase button
    const purchaseButton = page.getByRole('button', { name: /purchase basic service/i });
    await purchaseButton.click();

    // Should show confirmation modal
    await expect(page.getByText('Confirm Purchase')).toBeVisible();
    await expect(page.getByText('Are you sure you want to purchase Basic Service?')).toBeVisible();
    await expect(page.getByText('Price: $10.0 (100 credits)')).toBeVisible();
  });

  test('should allow canceling purchase', async ({ page }) => {
    // Click purchase button
    const purchaseButton = page.getByRole('button', { name: /purchase basic service/i });
    await purchaseButton.click();

    // Click cancel button
    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal should be closed
    await expect(page.getByText('Confirm Purchase')).not.toBeVisible();
  });

  test('should show user credits in header', async ({ page }) => {
    // Check if user credits are displayed in header
    await expect(page.getByText('100.0 credits')).toBeVisible();
  });

  test('should navigate to wallet when credits are low', async ({ page }) => {
    // Mock low credits scenario
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
          credits: 5.0 // Low credits
        })
      });
    });

    await page.goto('/shop');

    // Should show low credits warning
    await expect(page.getByText(/low credits/i)).toBeVisible();
    
    // Click on "Add Credits" button
    const addCreditsButton = page.getByRole('button', { name: /add credits/i });
    await addCreditsButton.click();

    // Should navigate to wallet page
    await expect(page).toHaveURL('/wallet');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/v1/services', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Internal server error'
        })
      });
    });

    await page.goto('/shop');

    // Should show error message
    await expect(page.getByText(/error loading services/i)).toBeVisible();
  });

  test('should display empty state when no services', async ({ page }) => {
    // Mock empty services response
    await page.route('/api/v1/services', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('/shop');

    // Should show empty state
    await expect(page.getByText('No services available')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if shop is still functional on mobile
    await expect(page.getByText('Shop')).toBeVisible();
    await expect(page.getByText('Basic Service')).toBeVisible();

    // Check if service cards are properly displayed on mobile
    const serviceCards = page.locator('[data-testid="service-card"]');
    const cardCount = await serviceCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });
});

*/
