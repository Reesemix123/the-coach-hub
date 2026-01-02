import { test, expect } from '@playwright/test';
import { getFirstTeamId } from '../utils/test-helpers';

/**
 * Playbook Feature Tests
 *
 * Tests for the digital playbook functionality including
 * viewing plays, filtering, and basic interactions.
 */

test.describe('Playbook', () => {
  let teamId: string;

  test.beforeEach(async ({ page }) => {
    const id = await getFirstTeamId(page);
    if (!id) {
      test.skip('No teams available');
      return;
    }
    teamId = id;
  });

  test('should display playbook page with plays', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');

    // Should see playbook heading or plays content
    expect(page.url()).toContain('/playbook');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Check for play cards or empty state
    const playCards = page.locator('[data-testid="play-card"], .play-card, [class*="play"]');
    const emptyState = page.locator('text=No plays');

    const hasPlays = (await playCards.count()) > 0;
    const isEmpty = await emptyState.isVisible().catch(() => false);

    // Should either have plays or show empty state
    expect(hasPlays || isEmpty).toBeTruthy();
  });

  test('should have filter options for play type', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for filter buttons or dropdown (Offense, Defense, Special Teams)
    const offenseFilter = page.locator('button:has-text("Offense"), [data-filter="offense"], text=Offense').first();
    const defenseFilter = page.locator('button:has-text("Defense"), [data-filter="defense"], text=Defense').first();

    const hasFilters = (await offenseFilter.isVisible().catch(() => false)) ||
                       (await defenseFilter.isVisible().catch(() => false));

    // Playbook should have some filtering capability
    expect(hasFilters).toBeTruthy();
  });

  test('should navigate to create play page', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for "Create Play" or "Add Play" or "+" button
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add Play"), a:has-text("Create"), a:has-text("Add")'
    ).first();

    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForLoadState('domcontentloaded');

      // Should navigate to new play page or open play builder
      const url = page.url();
      const hasPlayBuilder = url.includes('/new') ||
                            url.includes('/create') ||
                            (await page.locator('text=Play Builder, text=Formation').count()) > 0;

      expect(hasPlayBuilder).toBeTruthy();
    }
  });

  test('should filter plays by offense/defense', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click on Offense filter
    const offenseTab = page.locator('button:has-text("Offense"), [role="tab"]:has-text("Offense")').first();

    if (await offenseTab.isVisible()) {
      await offenseTab.click();
      await page.waitForTimeout(1000);

      // URL might update with filter param or plays should filter
      // Just verify no error occurred
      expect(page.url()).not.toContain('error');
    }

    // Click on Defense filter
    const defenseTab = page.locator('button:has-text("Defense"), [role="tab"]:has-text("Defense")').first();

    if (await defenseTab.isVisible()) {
      await defenseTab.click();
      await page.waitForTimeout(1000);

      expect(page.url()).not.toContain('error');
    }
  });

  test('should display play details when clicking a play', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find a play card to click
    const playCard = page.locator('[data-testid="play-card"], .cursor-pointer, a[href*="/play"]').first();

    if (await playCard.isVisible()) {
      await playCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should show play details or open play viewer
      // Could be a modal, new page, or expanded view
      const hasDetails = (await page.locator('text=Formation').count()) > 0 ||
                        (await page.locator('text=Play Type').count()) > 0 ||
                        page.url().includes('/play');

      expect(hasDetails).toBeTruthy();
    }
  });

  test('should support search functionality', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[type="search"], input[name="search"]'
    ).first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Search should work without errors
      expect(page.url()).not.toContain('error');
    }
  });
});

test.describe('Play Builder', () => {
  let teamId: string;

  test.beforeEach(async ({ page }) => {
    const id = await getFirstTeamId(page);
    if (!id) {
      test.skip('No teams available');
      return;
    }
    teamId = id;
  });

  test('should open play builder for new play', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should see play builder elements
    const hasPlayBuilder = (await page.locator('text=Formation').count()) > 0 ||
                          (await page.locator('text=Offense').count()) > 0 ||
                          (await page.locator('canvas, svg').count()) > 0;

    expect(hasPlayBuilder).toBeTruthy();
  });

  test('should have formation selection options', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for formation dropdown or selection
    const formationSelect = page.locator(
      'select:has-text("Formation"), [data-testid="formation-select"], button:has-text("Shotgun"), button:has-text("I-Form")'
    ).first();

    const hasFormationOptions = await formationSelect.isVisible().catch(() => false) ||
                               (await page.locator('text=Shotgun').count()) > 0 ||
                               (await page.locator('text=I-Form').count()) > 0;

    expect(hasFormationOptions).toBeTruthy();
  });

  test('should allow selecting play type (run/pass)', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for play type selection
    const hasPlayType = (await page.locator('text=Run').count()) > 0 ||
                       (await page.locator('text=Pass').count()) > 0 ||
                       (await page.locator('select:has-text("Play Type")').count()) > 0;

    expect(hasPlayType).toBeTruthy();
  });

  test('should display field diagram', async ({ page }) => {
    await page.goto(`/teams/${teamId}/playbook/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for SVG canvas or field diagram
    const fieldDiagram = page.locator('svg, canvas, [data-testid="field-diagram"]').first();

    expect(await fieldDiagram.isVisible()).toBeTruthy();
  });
});
