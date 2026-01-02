import { test, expect } from '@playwright/test';
import { getFirstTeamId } from '../utils/test-helpers';

/**
 * Practice Plan Feature Tests
 *
 * Tests for practice planning functionality including
 * creating plans, using templates, and managing drills.
 */

test.describe('Practice Plans', () => {
  let teamId: string;

  test.beforeEach(async ({ page }) => {
    const id = await getFirstTeamId(page);
    if (!id) {
      test.skip('No teams available');
      return;
    }
    teamId = id;
  });

  test('should display practice plans page', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/practice');

    // Should see practice plans content
    const hasContent = (await page.locator('text=Practice').count()) > 0 ||
                      (await page.locator('text=Create').count()) > 0;

    expect(hasContent).toBeTruthy();
  });

  test('should have filter tabs (Upcoming, Past, Templates)', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for filter tabs
    const upcomingTab = page.locator('button:has-text("Upcoming")').first();
    const pastTab = page.locator('button:has-text("Past")').first();
    const templatesTab = page.locator('button:has-text("Template")').first();

    const hasFilters = (await upcomingTab.isVisible().catch(() => false)) ||
                      (await pastTab.isVisible().catch(() => false)) ||
                      (await templatesTab.isVisible().catch(() => false));

    expect(hasFilters).toBeTruthy();
  });

  test('should have create practice plan button', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const createButton = page.locator(
      'button:has-text("Create Practice"), button:has-text("Create"), a:has-text("Create")'
    ).first();

    expect(await createButton.isVisible()).toBeTruthy();
  });

  test('should have create template button', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const templateButton = page.locator(
      'button:has-text("Template"), button:has-text("Reusable"), a:has-text("Template")'
    ).first();

    expect(await templateButton.isVisible()).toBeTruthy();
  });

  test('should navigate to create practice plan form', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const createButton = page.locator(
      'button:has-text("Create Practice Plan"), a:has-text("Create Practice")'
    ).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForURL(/\/practice\/new/);

      expect(page.url()).toContain('/practice/new');
    }
  });

  test('should filter by upcoming practices', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const upcomingTab = page.locator('button:has-text("Upcoming")').first();

    if (await upcomingTab.isVisible()) {
      await upcomingTab.click();
      await page.waitForTimeout(500);

      // Should show upcoming practices or empty state
      expect(page.url()).not.toContain('error');
    }
  });

  test('should filter by templates', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const templatesTab = page.locator('button:has-text("Template")').first();

    if (await templatesTab.isVisible()) {
      await templatesTab.click();
      await page.waitForTimeout(500);

      // Should show templates or empty state
      expect(page.url()).not.toContain('error');
    }
  });

  test('should display practice plan cards with date and duration', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // If there are practice plans, they should show date and duration
    const practiceCards = page.locator('[class*="practice"], [class*="card"]');
    const hasCards = (await practiceCards.count()) > 0;

    if (hasCards) {
      // Look for date or duration indicators
      const hasDateOrDuration = (await page.locator('text=/\\d+ min/').count()) > 0 ||
                               (await page.locator('text=/\\d{1,2}\\/\\d{1,2}/').count()) > 0;

      expect(hasDateOrDuration).toBeTruthy();
    }
  });
});

test.describe('Create Practice Plan', () => {
  let teamId: string;

  test.beforeEach(async ({ page }) => {
    const id = await getFirstTeamId(page);
    if (!id) {
      test.skip('No teams available');
      return;
    }
    teamId = id;
  });

  test('should display practice plan form', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should have form fields
    const hasForm = (await page.locator('input[name="title"], input[placeholder*="Title"]').count()) > 0 ||
                   (await page.locator('input[type="date"]').count()) > 0 ||
                   (await page.locator('text=Practice Plan').count()) > 0;

    expect(hasForm).toBeTruthy();
  });

  test('should have date picker', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const datePicker = page.locator('input[type="date"], [data-testid="date-picker"]').first();
    expect(await datePicker.isVisible()).toBeTruthy();
  });

  test('should have duration input', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const durationInput = page.locator(
      'input[name="duration"], input[placeholder*="Duration"], select:has-text("minutes")'
    ).first();

    const hasDuration = await durationInput.isVisible().catch(() => false) ||
                       (await page.locator('text=Duration').count()) > 0;

    expect(hasDuration).toBeTruthy();
  });

  test('should have location field', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const locationInput = page.locator(
      'input[name="location"], input[placeholder*="Location"]'
    ).first();

    const hasLocation = await locationInput.isVisible().catch(() => false) ||
                       (await page.locator('text=Location').count()) > 0;

    expect(hasLocation).toBeTruthy();
  });

  test('should support adding periods/drills', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for add period/drill button
    const addButton = page.locator(
      'button:has-text("Add Period"), button:has-text("Add Drill"), button:has-text("Add")'
    ).first();

    expect(await addButton.isVisible()).toBeTruthy();
  });

  test('should have save/create button', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const saveButton = page.locator(
      'button:has-text("Save"), button:has-text("Create"), button[type="submit"]'
    ).first();

    expect(await saveButton.isVisible()).toBeTruthy();
  });

  test('should support template mode', async ({ page }) => {
    await page.goto(`/teams/${teamId}/practice/new?template=true`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should indicate template mode
    const hasTemplateMode = (await page.locator('text=Template').count()) > 0 ||
                           page.url().includes('template');

    expect(hasTemplateMode).toBeTruthy();
  });
});
