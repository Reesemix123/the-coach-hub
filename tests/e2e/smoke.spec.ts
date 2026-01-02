import { test, expect } from '@playwright/test';
import { navigateToTeamPage, waitForContentLoad, getFirstTeamId } from '../utils/test-helpers';

/**
 * Smoke Tests
 *
 * Basic tests to verify the app is working and authentication is set up correctly.
 * These tests run first to ensure the foundation is stable.
 */

test.describe('Smoke Tests', () => {
  test('should be authenticated and not on login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should NOT be redirected to login page
    expect(page.url()).not.toContain('/auth/login');
  });

  test('should have at least one team', async ({ page }) => {
    const teamId = await getFirstTeamId(page);
    expect(teamId).toBeTruthy();
  });

  test('should navigate to team dashboard', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState('domcontentloaded');

    // Should be on team page and see navigation
    expect(page.url()).toContain(`/teams/${teamId}`);
  });

  test('should access roster page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/roster');
  });

  test('should access playbook page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/playbook');
  });

  test('should access schedule page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/schedule`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/schedule');
  });

  test('should access practice plans page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/practice`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/practice');
  });

  test('should access film page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/film`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/film');
  });

  test('should access analytics page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/analytics-reporting`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/analytics');
  });

  test('should access settings page', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}/settings`);
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/settings');
  });
});

test.describe('Navigation', () => {
  test('should have working team navigation', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for React to hydrate
    await page.waitForTimeout(2000);

    // Check for navigation links by looking for common nav items
    const navItems = ['Schedule', 'Players', 'Playbook', 'Practice', 'Film'];
    let foundCount = 0;

    for (const item of navItems) {
      const count = await page.locator(`a:has-text("${item}"), [role="tab"]:has-text("${item}")`).count();
      if (count > 0) foundCount++;
    }

    // Should find at least some navigation items
    expect(foundCount).toBeGreaterThanOrEqual(3);
  });

  test('should navigate between pages via links', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    // Start on dashboard
    await page.goto(`/teams/${teamId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click on Playbook link and wait for navigation
    const playbookLink = page.locator('a:has-text("Playbook")').first();
    if (await playbookLink.isVisible()) {
      await playbookLink.click();
      await page.waitForURL(/\/playbook/, { timeout: 15000 });
      expect(page.url()).toContain('/playbook');
    }
  });
});

test.describe('User Session', () => {
  test('should maintain auth across page navigation', async ({ page }) => {
    const teamId = await getFirstTeamId(page);

    if (!teamId) {
      test.skip('No teams available');
      return;
    }

    // Navigate to multiple pages
    const pages = ['', '/roster', '/playbook', '/schedule'];

    for (const pagePath of pages) {
      await page.goto(`/teams/${teamId}${pagePath}`);
      await page.waitForLoadState('domcontentloaded');

      // Should not be redirected to login
      expect(page.url()).not.toContain('/auth/login');
    }
  });
});
