import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('https://www.google.com');
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('https://www.google.com');
  });
});
