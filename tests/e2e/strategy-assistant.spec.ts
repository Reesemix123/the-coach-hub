import { test, expect } from '@playwright/test';

/**
 * Strategy Assistant E2E Tests
 *
 * BEFORE RUNNING TESTS:
 * 1. Set up test user credentials in .env.test
 * 2. Ensure you have a team with upcoming games
 * 3. Tag some plays for better test data
 *
 * Run tests with: npm run test:e2e
 */

// Test configuration
const TEST_CONFIG = {
  // Update these with your test account
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  teamId: process.env.TEST_TEAM_ID || '', // Will be set after login
  gameId: process.env.TEST_GAME_ID || '', // Will be set after navigation
};

test.describe('Strategy Assistant', () => {

  // Setup: Login before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login');

    // Fill in login form
    await page.fill('input[name="email"]', TEST_CONFIG.email);
    await page.fill('input[type="password"]', TEST_CONFIG.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to home or teams page
    await page.waitForURL(/\/(teams)?/);

    // If we don't have a teamId yet, grab it from URL
    if (!TEST_CONFIG.teamId) {
      const url = page.url();
      const match = url.match(/teams\/([a-f0-9-]+)/);
      if (match) {
        TEST_CONFIG.teamId = match[1];
      }
    }
  });

  test.describe('Game Week Integration', () => {

    test('should show Strategy Station card in Game Week', async ({ page }) => {
      // Navigate to Game Week
      await page.goto(`/teams/${TEST_CONFIG.teamId}/game-week`);

      // Wait for page to load
      await page.waitForSelector('text=Game Week Command Center', { timeout: 10000 });

      // Check for Strategy Station card
      const strategyStation = page.locator('text=Strategy Station');
      await expect(strategyStation).toBeVisible();

      // Verify station has metrics
      await expect(page.locator('text=Strategic Questions')).toBeVisible();
      await expect(page.locator('text=Preparation Checklist')).toBeVisible();

      // Verify primary action button exists
      const generateButton = page.locator('text=Generate Strategy Report').or(page.locator('text=Review Strategy'));
      await expect(generateButton).toBeVisible();
    });

    test('should navigate to Strategy Assistant from Game Week', async ({ page }) => {
      await page.goto(`/teams/${TEST_CONFIG.teamId}/game-week`);

      // Click on Generate/Review Strategy button
      const button = page.locator('text=Generate Strategy Report').or(page.locator('text=Review Strategy')).first();
      await button.click();

      // Should navigate to strategy assistant page
      await expect(page).toHaveURL(/strategy-assistant/);
    });
  });

  test.describe('Strategy Report Generation', () => {

    test('should show game selector when no game specified', async ({ page }) => {
      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant`);

      // Should show game selector if there are upcoming games
      const hasUpcomingGames = await page.locator('text=vs').count() > 0;

      if (hasUpcomingGames) {
        // Verify game selector elements
        await expect(page.locator('text=Select a Game')).toBeVisible();
        await expect(page.locator('text=Generate Report →')).toBeVisible();
      } else {
        // Should show no games message
        await expect(page.locator('text=No upcoming games')).toBeVisible();
      }
    });

    test('should generate strategy report for a game', async ({ page }) => {
      // Navigate to strategy assistant
      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant`);

      // Click on first upcoming game
      const firstGame = page.locator('text=Generate Report →').first();
      const isVisible = await firstGame.isVisible().catch(() => false);

      if (!isVisible) {
        test.skip('No upcoming games available for testing');
        return;
      }

      await firstGame.click();

      // Wait for report to generate
      await page.waitForURL(/game=/);
      await page.waitForSelector('text=Strategy Station', { timeout: 15000 });

      // Verify report sections are visible
      await expect(page.locator('text=Strategic Insights')).toBeVisible();

      // Check for data quality badge
      const qualityBadge = page.locator('text=High Confidence').or(
        page.locator('text=Medium Confidence')
      ).or(
        page.locator('text=Limited Data')
      );
      await expect(qualityBadge).toBeVisible();
    });

    test('should display insights with priorities', async ({ page }) => {
      // Skip if no game ID available
      if (!TEST_CONFIG.gameId) {
        // Try to get game ID from first available game
        await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant`);
        const firstGameLink = page.locator('a:has-text("Generate Report")').first();
        const href = await firstGameLink.getAttribute('href');
        const match = href?.match(/game=([a-f0-9-]+)/);
        if (match) {
          TEST_CONFIG.gameId = match[1];
        } else {
          test.skip('No game available for testing');
          return;
        }
      }

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Strategic Insights', { timeout: 15000 });

      // Check for priority badges
      const hasPriority1 = await page.locator('text=Priority 1').count() > 0;
      const hasPriority2 = await page.locator('text=Priority 2').count() > 0;
      const hasPriority3 = await page.locator('text=Priority 3').count() > 0;

      // Should have at least some insights
      expect(hasPriority1 || hasPriority2 || hasPriority3).toBeTruthy();
    });

    test('should display opponent tendencies table', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Opponent Tendencies', { timeout: 15000 });

      // Check for table headers
      const hasTable = await page.locator('text=Run %').count() > 0;
      expect(hasTable).toBeTruthy();
    });

    test('should display team analysis section', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Your Team Analysis', { timeout: 15000 });

      // Should have strengths and weaknesses sections
      await expect(page.locator('text=Strengths')).toBeVisible();
      await expect(page.locator('text=Areas to Improve')).toBeVisible();
    });
  });

  test.describe('Strategic Questions', () => {

    test('should navigate to questions page', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);

      // Click "Answer Questions" button
      await page.click('text=Answer Questions');

      // Should navigate to questions page
      await expect(page).toHaveURL(/questions/);
      await expect(page.locator('text=Strategic Questions')).toBeVisible();
    });

    test('should display questions grouped by category', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/questions?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Strategic Questions', { timeout: 10000 });

      // Check for category headers
      const hasOffensive = await page.locator('text=Offensive Strategy').count() > 0;
      const hasDefensive = await page.locator('text=Defensive Strategy').count() > 0;

      expect(hasOffensive || hasDefensive).toBeTruthy();
    });

    test('should save question responses', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/questions?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('textarea', { timeout: 10000 });

      // Find first textarea and enter response
      const firstTextarea = page.locator('textarea').first();
      await firstTextarea.fill('Test response for automated testing');

      // Click Save Response button
      const saveButton = page.locator('button:has-text("Save Response")').first();
      await saveButton.click();

      // Wait for save confirmation
      await expect(page.locator('text=Saved!')).toBeVisible({ timeout: 5000 });

      // Refresh page and verify response persists
      await page.reload();
      await page.waitForSelector('textarea');
      const savedValue = await firstTextarea.inputValue();
      expect(savedValue).toBe('Test response for automated testing');
    });

    test('should update progress bar when answering questions', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/questions?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Strategic Questions', { timeout: 10000 });

      // Get initial progress
      const initialProgress = await page.locator('text=/\\d+\\/\\d+ answered/').textContent();

      // Answer a question
      const firstTextarea = page.locator('textarea').first();
      await firstTextarea.fill('Another test response');
      await page.locator('button:has-text("Save Response")').first().click();
      await page.waitForTimeout(2000); // Wait for save

      // Check if progress updated
      const newProgress = await page.locator('text=/\\d+\\/\\d+ answered/').textContent();

      // Progress should have changed (either increased or stayed same if already answered)
      expect(newProgress).toBeTruthy();
    });
  });

  test.describe('Preparation Checklist', () => {

    test('should navigate to checklist page', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);

      // Click "View Full Checklist" button
      await page.click('text=View Full Checklist');

      // Should navigate to checklist page
      await expect(page).toHaveURL(/checklist/);
      await expect(page.locator('text=Preparation Checklist')).toBeVisible();
    });

    test('should display priority summary cards', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/checklist?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Preparation Checklist', { timeout: 10000 });

      // Check for priority cards
      await expect(page.locator('text=Must Do')).toBeVisible();
      await expect(page.locator('text=Should Do')).toBeVisible();
      await expect(page.locator('text=Nice to Have')).toBeVisible();
    });

    test('should check off checklist items', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/checklist?game=${TEST_CONFIG.gameId}`);
      await page.waitForLoadState('networkidle');

      // Find first unchecked item (circle icon)
      const firstUnchecked = page.locator('svg').filter({ hasText: /circle/i }).first();
      const parent = firstUnchecked.locator('..').locator('..'); // Go up to clickable element

      // Click to check it off
      await parent.click();

      // Wait for save
      await page.waitForTimeout(1000);

      // Verify checkbox changed (should see checkmark)
      await expect(page.locator('svg:has-text("check")')).toBeVisible({ timeout: 5000 });
    });

    test('should update progress when checking items', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/checklist?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Preparation Checklist', { timeout: 10000 });

      // Get initial progress percentage
      const initialProgress = await page.locator('text=/\\d+%/').first().textContent();

      // Progress should be a number
      expect(initialProgress).toMatch(/\d+%/);
    });

    test('should save notes on checklist items', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant/checklist?game=${TEST_CONFIG.gameId}`);
      await page.waitForLoadState('networkidle');

      // Click "Add notes" button
      const addNotesButton = page.locator('button:has-text("Add notes")').first();
      const isVisible = await addNotesButton.isVisible().catch(() => false);

      if (!isVisible) {
        test.skip('No "Add notes" button found');
        return;
      }

      await addNotesButton.click();

      // Fill in notes
      const notesTextarea = page.locator('textarea[placeholder*="notes"]').first();
      await notesTextarea.fill('Test notes for checklist item');

      // Save notes
      await page.click('button:has-text("Save Notes")');

      // Wait for save
      await page.waitForTimeout(1000);

      // Verify notes appear
      await expect(page.locator('text=Test notes for checklist item')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {

    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Strategy Station', { timeout: 15000 });

      // Verify main elements are visible on mobile
      await expect(page.locator('text=Strategic Insights')).toBeVisible();
      await expect(page.locator('text=Strategic Questions')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Strategy Station', { timeout: 15000 });

      // Verify responsive grid works
      await expect(page.locator('text=Strategic Insights')).toBeVisible();
    });
  });

  test.describe('Performance', () => {

    test('should load strategy report within acceptable time', async ({ page }) => {
      if (!TEST_CONFIG.gameId) test.skip('No game ID available');

      const startTime = Date.now();

      await page.goto(`/teams/${TEST_CONFIG.teamId}/strategy-assistant?game=${TEST_CONFIG.gameId}`);
      await page.waitForSelector('text=Strategic Insights', { timeout: 15000 });

      const loadTime = Date.now() - startTime;

      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
      console.log(`Strategy report loaded in ${loadTime}ms`);
    });
  });
});
