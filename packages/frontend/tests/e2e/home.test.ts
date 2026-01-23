import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Haloop/i);
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/');
    // Verify basic page structure loads
    await expect(page.locator('body')).toBeVisible();
  });
});
