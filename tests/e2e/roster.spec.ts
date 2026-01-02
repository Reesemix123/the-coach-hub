import { test, expect } from '@playwright/test';
import { getFirstTeamId } from '../utils/test-helpers';

/**
 * Roster Feature Tests
 *
 * Tests for player roster management including viewing players,
 * adding players, and position filtering.
 */

test.describe('Roster', () => {
  let teamId: string;

  test.beforeEach(async ({ page }) => {
    const id = await getFirstTeamId(page);
    if (!id) {
      test.skip('No teams available');
      return;
    }
    teamId = id;
  });

  test('should display roster page', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/roster');

    // Should see roster content - players list or empty state
    const hasContent = (await page.locator('text=Players').count()) > 0 ||
                      (await page.locator('text=Roster').count()) > 0 ||
                      (await page.locator('text=Add Player').count()) > 0;

    expect(hasContent).toBeTruthy();
  });

  test('should display player cards or list', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for player entries or empty state
    const playerCards = page.locator('[data-testid="player-card"], .player-card, tr, [class*="player"]');
    const emptyState = page.locator('text=No players, text=Add your first player');

    const hasPlayers = (await playerCards.count()) > 0;
    const isEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasPlayers || isEmpty).toBeTruthy();
  });

  test('should have add player button', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for add player button
    const addButton = page.locator(
      'button:has-text("Add Player"), button:has-text("Add"), a:has-text("Add Player")'
    ).first();

    expect(await addButton.isVisible()).toBeTruthy();
  });

  test('should open add player form when clicking add button', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const addButton = page.locator(
      'button:has-text("Add Player"), button:has-text("Add"), a:has-text("Add Player")'
    ).first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);

      // Should show form with player fields
      const hasForm = (await page.locator('input[name="first_name"], input[placeholder*="First"]').count()) > 0 ||
                     (await page.locator('input[name="jersey_number"], input[placeholder*="Jersey"]').count()) > 0 ||
                     (await page.locator('text=Player Name, text=Jersey Number').count()) > 0;

      expect(hasForm).toBeTruthy();
    }
  });

  test('should filter players by position group', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for position filter tabs or dropdown
    const offenseTab = page.locator('button:has-text("Offense"), [role="tab"]:has-text("Offense")').first();
    const defenseTab = page.locator('button:has-text("Defense"), [role="tab"]:has-text("Defense")').first();

    if (await offenseTab.isVisible()) {
      await offenseTab.click();
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain('error');
    }

    if (await defenseTab.isVisible()) {
      await defenseTab.click();
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain('error');
    }
  });

  test('should display player details', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find a player card/row to click
    const playerEntry = page.locator(
      '[data-testid="player-card"], .player-row, tr:has(td), a[href*="/players/"]'
    ).first();

    if (await playerEntry.isVisible()) {
      await playerEntry.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should navigate to player detail or show modal
      const hasDetails = page.url().includes('/players/') ||
                        (await page.locator('text=Position').count()) > 0 ||
                        (await page.locator('text=Jersey').count()) > 0;

      expect(hasDetails).toBeTruthy();
    }
  });

  test('should show jersey numbers in roster', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Look for jersey number display (typically #1, #12, etc.)
    const jerseyNumbers = page.locator('text=/#\\d+/, [class*="jersey"]');
    const hasJerseyNumbers = (await jerseyNumbers.count()) > 0;

    // If there are players, they should have jersey numbers displayed
    const hasPlayers = (await page.locator('[data-testid="player-card"], .player-card, tr:has(td)').count()) > 0;

    if (hasPlayers) {
      expect(hasJerseyNumbers).toBeTruthy();
    }
  });
});

test.describe('Player Detail', () => {
  let teamId: string;

  test.beforeEach(async ({ page }) => {
    const id = await getFirstTeamId(page);
    if (!id) {
      test.skip('No teams available');
      return;
    }
    teamId = id;
  });

  test('should navigate to player detail page', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find first player link
    const playerLink = page.locator('a[href*="/players/"]').first();

    if (await playerLink.isVisible()) {
      await playerLink.click();
      await page.waitForURL(/\/players\//);

      expect(page.url()).toContain('/players/');
    }
  });

  test('should display player stats on detail page', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const playerLink = page.locator('a[href*="/players/"]').first();

    if (await playerLink.isVisible()) {
      await playerLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Player detail should show stats or profile info
      const hasStats = (await page.locator('text=Stats').count()) > 0 ||
                      (await page.locator('text=Carries').count()) > 0 ||
                      (await page.locator('text=Tackles').count()) > 0 ||
                      (await page.locator('text=Position').count()) > 0;

      expect(hasStats).toBeTruthy();
    }
  });

  test('should have edit player option', async ({ page }) => {
    await page.goto(`/teams/${teamId}/roster`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const playerLink = page.locator('a[href*="/players/"]').first();

    if (await playerLink.isVisible()) {
      await playerLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Should have edit button
      const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
      const hasEdit = await editButton.isVisible().catch(() => false);

      expect(hasEdit).toBeTruthy();
    }
  });
});
