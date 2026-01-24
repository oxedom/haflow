import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.getByRole('heading', { name: 'HAFLOW', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('should display welcome message when no mission selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Welcome to haflow')).toBeVisible();
    await expect(page.getByText('Select a mission from the sidebar or create a new one.')).toBeVisible();
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for sidebar elements
    await expect(page.getByRole('button', { name: /new mission/i })).toBeVisible();

    // Check for header voice chat button (desktop)
    const headphonesButton = page.getByTestId('voice-chat-button-desktop');
    await expect(headphonesButton).toBeVisible();
  });

  test('should open new mission modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click new mission button
    await page.getByRole('button', { name: /new mission/i }).click();

    // Modal should be visible
    await expect(page.getByRole('heading', { name: 'New Mission' })).toBeVisible();
    await expect(page.locator('input#title')).toBeVisible();
    await expect(page.locator('textarea#rawInput')).toBeVisible();
  });

  test('should close new mission modal on cancel', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /new mission/i }).click();
    await expect(page.getByRole('heading', { name: 'New Mission' })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'New Mission' })).not.toBeVisible();
  });
});

test.describe('API Health Checks', () => {
  test('should have healthy backend API', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/missions');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
  });

  test('should have transcription status endpoint', async ({ request }) => {
    const response = await request.get('http://localhost:4000/api/transcribe/status');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body.data).toHaveProperty('available');
  });
});
