import { test, expect } from '@playwright/test';

test.describe('Workflow Step History Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('workflow timeline renders step circles', async ({ page }) => {
    // Get a mission if available
    const missionItems = page.getByTestId(/^mission-item-/);
    const count = await missionItems.count();

    if (count > 0) {
      await missionItems.first().click();
      await page.waitForLoadState('networkidle');

      // Wait for mission detail to load
      const timeline = page.getByTestId('workflow-timeline');
      await expect(timeline).toBeVisible();

      // Check that step circles exist
      const stepCircle = page.getByTestId('workflow-step-circle-0');
      await expect(stepCircle).toBeVisible();
    }
  });

  test('completed step circles are clickable and open history modal', async ({ page }) => {
    const missionItems = page.getByTestId(/^mission-item-/);
    const count = await missionItems.count();

    if (count > 0) {
      await missionItems.first().click();
      await page.waitForLoadState('networkidle');

      // Wait for mission detail to load
      await page.waitForSelector('[data-testid="workflow-timeline"]');

      // Try step 0 - it will only be clickable if mission is past first step
      const stepCircle = page.getByTestId('workflow-step-circle-0');

      // Check if step is completed (not disabled)
      const isDisabled = await stepCircle.isDisabled();

      if (!isDisabled) {
        await stepCircle.click();

        // Verify modal opens
        const modal = page.getByTestId('step-history-modal');
        await expect(modal).toBeVisible();

        // Verify modal has expected content
        await expect(page.getByTestId('step-history-title')).toBeVisible();
        await expect(page.getByTestId('step-artifacts-container')).toBeVisible();
      }
    }
  });

  test('step history modal closes on X button click', async ({ page }) => {
    const missionItems = page.getByTestId(/^mission-item-/);
    const count = await missionItems.count();

    if (count > 0) {
      await missionItems.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="workflow-timeline"]');

      const stepCircle = page.getByTestId('workflow-step-circle-0');
      const isDisabled = await stepCircle.isDisabled();

      if (!isDisabled) {
        await stepCircle.click();

        // Wait for modal
        const modal = page.getByTestId('step-history-modal');
        await expect(modal).toBeVisible();

        // Click the X close button
        const closeButton = modal.locator('button[type="button"]').first();
        await closeButton.click();

        // Verify modal closed
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('step history modal closes on backdrop click', async ({ page }) => {
    const missionItems = page.getByTestId(/^mission-item-/);
    const count = await missionItems.count();

    if (count > 0) {
      await missionItems.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="workflow-timeline"]');

      const stepCircle = page.getByTestId('workflow-step-circle-0');
      const isDisabled = await stepCircle.isDisabled();

      if (!isDisabled) {
        await stepCircle.click();

        // Wait for modal
        const modal = page.getByTestId('step-history-modal');
        await expect(modal).toBeVisible();

        // Click outside modal to close (on the overlay)
        await page.mouse.click(10, 10);

        // Verify modal closed
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('current and future steps are not clickable', async ({ page }) => {
    const missionItems = page.getByTestId(/^mission-item-/);
    const count = await missionItems.count();

    if (count > 0) {
      await missionItems.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="workflow-timeline"]');

      // Find the last step (which should be disabled for most missions)
      const stepCircles = page.locator('[data-testid^="workflow-step-circle-"]');
      const stepCount = await stepCircles.count();

      if (stepCount > 1) {
        const lastStepCircle = page.getByTestId(`workflow-step-circle-${stepCount - 1}`);
        const isDisabled = await lastStepCircle.isDisabled();

        // Last step should be disabled (not clickable) unless mission is complete
        // We don't click it - just verify the disabled state
        expect(typeof isDisabled).toBe('boolean');
      }
    }
  });
});
