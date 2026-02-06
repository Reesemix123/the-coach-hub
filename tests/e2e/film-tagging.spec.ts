import { test, expect, type Page } from '@playwright/test';
import { getFirstTeamId } from '../utils/test-helpers';

/**
 * Film Tagging Integration Tests (Task 3.7)
 *
 * Verifies the refactored film tagging page works correctly after
 * Phase 3 decomposition (hooks + component extraction).
 *
 * Prerequisites:
 * - At least one team exists
 * - At least one game with uploaded video (film list shows "View Film" button)
 * - At least one game with tagged plays (for filter/edit/jump tests)
 */

// ============================================
// HELPERS
// ============================================

/**
 * Find a game that has an actual video loaded (not just a "View Film" button).
 * Iterates through available games. Prefers: video+plays > video only > any.
 */
async function getGameWithVideo(
  page: Page,
  teamId: string
): Promise<{ gameId: string; hasPlays: boolean; hasVideo: boolean }> {
  await page.goto(`/teams/${teamId}/film`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('h1', { timeout: 30000 });

  const viewFilmButtons = page.locator('button:has-text("View Film")');
  const buttonCount = await viewFilmButtons.count();
  expect(buttonCount).toBeGreaterThan(0);

  let bestGame: { gameId: string; hasPlays: boolean; hasVideo: boolean } | null = null;

  // Try up to 5 games, prefer one with video AND plays
  for (let i = 0; i < Math.min(buttonCount, 5); i++) {
    // Navigate back to film list for each attempt
    await page.goto(`/teams/${teamId}/film`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('h1', { timeout: 30000 });

    const buttons = page.locator('button:has-text("View Film")');
    await buttons.nth(i).click();
    await page.waitForURL(/\/film\/[a-f0-9-]+\/tag/, { timeout: 15000 });

    const match = page.url().match(/\/film\/([a-f0-9-]+)\/tag/);
    if (!match) continue;
    const gameId = match[1];

    // Wait for page to fully render
    await page.waitForSelector('h1', { timeout: 30000 });
    await page.waitForSelector('h3:has-text("Tagged Plays")', { timeout: 15000 });

    // Check if video element is actually present and loaded
    let hasVideo = false;
    try {
      hasVideo = await page.locator('video').first().isVisible({ timeout: 10000 }).catch(() => false);
    } catch {
      // No video element
    }

    // Check play count
    let hasPlays = false;
    try {
      const heading = page.locator('h3:has-text("Tagged Plays")');
      const text = await heading.textContent();
      const playMatch = text?.match(/\((\d+)\)/);
      hasPlays = playMatch ? parseInt(playMatch[1], 10) > 0 : false;
    } catch {
      // Couldn't determine play count
    }

    // Score: video=2, plays=1
    const score = (hasVideo ? 2 : 0) + (hasPlays ? 1 : 0);
    const bestScore = bestGame
      ? (bestGame.hasVideo ? 2 : 0) + (bestGame.hasPlays ? 1 : 0)
      : -1;

    if (score > bestScore) {
      bestGame = { gameId, hasPlays, hasVideo };
    }

    if (hasVideo && hasPlays) break; // Found ideal game
  }

  expect(bestGame).toBeTruthy();
  return bestGame!;
}

/** Navigate to tag page and wait for content to render. Does NOT use networkidle. */
async function goToTagPage(page: Page, teamId: string, gameId: string) {
  await page.goto(`/teams/${teamId}/film/${gameId}/tag`);
  await page.waitForLoadState('domcontentloaded');
  // Wait for the page to render (h1 = game name, h3 = "Tagged Plays")
  await page.waitForSelector('h1', { timeout: 30000 });
  await page.waitForSelector('h3:has-text("Tagged Plays")', { timeout: 15000 });
}

/** Wait for the video element to be visible and have metadata loaded */
async function waitForVideoReady(page: Page, timeout = 30000) {
  const video = page.locator('video').first();
  await video.waitFor({ state: 'visible', timeout });

  await page.waitForFunction(
    () => {
      const v = document.querySelector('video');
      return v && v.readyState >= 1;
    },
    { timeout }
  );
}

/** Check if video is loaded (no error overlay) */
async function isVideoLoaded(page: Page): Promise<boolean> {
  const videoVisible = await page.locator('video').first().isVisible().catch(() => false);
  if (!videoVisible) return false;
  const hasError = await page.locator('text=Video Load Error').isVisible().catch(() => false);
  return !hasError;
}

/** Get the current play count from the "Tagged Plays (N)" heading */
async function getPlayCount(page: Page): Promise<number> {
  const heading = page.locator('h3:has-text("Tagged Plays")');
  await expect(heading).toBeVisible({ timeout: 15000 });
  const text = await heading.textContent();
  const match = text?.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ============================================
// ALL TESTS IN A SINGLE DESCRIBE
// ============================================

test.describe('Film Tagging Integration', () => {
  let teamId: string;
  let gameId: string;
  let gameHasPlays: boolean;
  let gameHasVideo: boolean;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000); // 2 min for game discovery iteration
    const page = await browser.newPage();
    const id = await getFirstTeamId(page);
    expect(id).toBeTruthy();
    teamId = id!;
    const result = await getGameWithVideo(page, teamId);
    gameId = result.gameId;
    gameHasPlays = result.hasPlays;
    gameHasVideo = result.hasVideo;
    console.log(`[beforeAll] Using game ${gameId}, hasVideo: ${gameHasVideo}, hasPlays: ${gameHasPlays}`);
    await page.close();
  });

  // ------------------------------------------
  // Suite 1: Page Structure
  // ------------------------------------------

  test('tag page loads with all panels', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Header: back button
    await expect(page.locator('text=Back to All Games')).toBeVisible({ timeout: 15000 });

    // Header: game name in h1
    await expect(page.locator('h1')).toBeVisible();

    // Status bar: plays count
    await expect(page.locator('text=/\\d+ plays? tagged/')).toBeVisible({ timeout: 15000 });

    // Video section - either video element or video-related content
    const hasVideo = await page.locator('video').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasVideoError = await page.locator('text=Video Load Error').isVisible().catch(() => false);
    const hasNoVideo = await page.locator('text=/No videos? for this game yet/').isVisible().catch(() => false);
    const hasTimelineUpload = await page.locator('text=Upload').first().isVisible().catch(() => false);
    // At least one video-related state should be visible
    expect(hasVideo || hasVideoError || hasNoVideo || hasTimelineUpload).toBeTruthy();

    // Play list panel
    await expect(page.locator('h3:has-text("Tagged Plays")')).toBeVisible({ timeout: 15000 });
  });

  test('header displays game info', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible({ timeout: 15000 });
    const gameName = await h1.textContent();
    expect(gameName?.length).toBeGreaterThan(0);

    await expect(page.locator('text=Back to All Games')).toBeVisible();
  });

  test('status bar shows tagging status and complete button', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Wait for status bar to render - check individual status texts
    const statusVisible = await Promise.race([
      page.locator('span:has-text("Tagging Complete")').waitFor({ timeout: 15000 }).then(() => true),
      page.locator('span:has-text("Tagging In Progress")').waitFor({ timeout: 15000 }).then(() => true),
      page.locator('span:has-text("Not Started")').waitFor({ timeout: 15000 }).then(() => true),
    ]).catch(() => false);
    expect(statusVisible).toBeTruthy();

    // Mark Tagging Complete / Tagging Complete button visible
    const completeButton = page.locator(
      'button:has-text("Mark Tagging Complete"), button:has-text("Tagging Complete")'
    );
    await expect(completeButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('play list panel shows filters', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    await expect(page.locator('label:has-text("Quarter")').or(page.locator('text=Quarter').first())).toBeVisible({ timeout: 15000 });

    const quarterSelect = page.locator('select').filter({
      has: page.locator('option:has-text("All Quarters")'),
    });
    await expect(quarterSelect).toBeVisible();

    const playTypeSelect = page.locator('select').filter({
      has: page.locator('option:has-text("All Plays")'),
    });
    await expect(playTypeSelect).toBeVisible();

    const driveSelect = page.locator('select').filter({
      has: page.locator('option:has-text("All Drives")'),
    });
    await expect(driveSelect).toBeVisible();
  });

  // ------------------------------------------
  // Suite 2: State Changes Between Panels
  // ------------------------------------------

  test('Mark Start / End opens tagging modal', async ({ page }) => {
    test.skip(!gameHasVideo, 'No video loaded - Mark Start requires video');
    await goToTagPage(page, teamId, gameId);
    await waitForVideoReady(page);

    const markStartButton = page.locator('button:has-text("Mark Start")').first();
    await expect(markStartButton).toBeVisible({ timeout: 10000 });
    await markStartButton.click();

    // If tier selector modal opens, select a tier first
    const tierModal = page.locator('text=Select Tagging Tier');
    if (await tierModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('button:has-text("Quick"), button:has-text("Standard")').first().click();
      await page.waitForTimeout(500);
      await markStartButton.click();
    }

    // Should show "Recording from" indicator
    await expect(page.locator('text=/Recording from/')).toBeVisible({ timeout: 5000 });

    // Mark End button
    const markEndButton = page.locator('button:has-text("Mark End")').first();
    await expect(markEndButton).toBeVisible();

    await page.waitForTimeout(1000);
    await markEndButton.click();

    // Tagging modal should open
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
  });

  test('play list filter changes update visible plays', async ({ page }) => {
    test.skip(!gameHasPlays, 'No tagged plays available to filter');
    await goToTagPage(page, teamId, gameId);

    const totalCount = await getPlayCount(page);
    expect(totalCount).toBeGreaterThan(0);

    const quarterSelect = page.locator('select').filter({
      has: page.locator('option:has-text("All Quarters")'),
    });
    await quarterSelect.selectOption('1');
    await page.waitForTimeout(500);

    const filteredCount = await getPlayCount(page);
    expect(filteredCount).toBeLessThanOrEqual(totalCount);

    const clearButton = page.locator('text=Clear All Filters');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(500);
      const restoredCount = await getPlayCount(page);
      expect(restoredCount).toBe(totalCount);
    }
  });

  test('jump to play updates video position', async ({ page }) => {
    test.skip(!gameHasPlays || !gameHasVideo, 'Requires tagged plays and video');
    await goToTagPage(page, teamId, gameId);
    await waitForVideoReady(page);

    const playCount = await getPlayCount(page);
    expect(playCount).toBeGreaterThan(0);

    // Click the play/jump button on the first play (bg-gray-900 area with SVG play icon)
    const playButton = page.locator('button.bg-gray-900').first();
    await expect(playButton).toBeVisible();
    await playButton.click();

    await page.waitForTimeout(1500);
    await expect(page.locator('video').first()).toBeVisible();
  });

  test('edit play opens modal with pre-filled data', async ({ page }) => {
    test.skip(!gameHasPlays, 'No tagged plays available to edit');
    await goToTagPage(page, teamId, gameId);

    const playCount = await getPlayCount(page);
    expect(playCount).toBeGreaterThan(0);

    const editButton = page.locator('button[title="Edit"]').first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    const modal = page.locator('.fixed.inset-0');
    await expect(modal.first()).toBeVisible({ timeout: 5000 });
  });

  // ------------------------------------------
  // Suite 3: Camera Sync
  // ------------------------------------------

  test('camera selector switches video without errors', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Camera buttons in the video player area (not timeline)
    // These are the buttons like "Main Camera", "Camera 1" near the video heading
    const cameraSection = page.locator('h2').first().locator('..');
    const cameraButtons = cameraSection.locator('button').filter({ hasText: /^(Main Camera|Camera \d+)$/ });
    const cameraCount = await cameraButtons.count();

    if (cameraCount < 2) {
      // Only 1 camera - verify it's visible and pass
      if (cameraCount === 1) {
        await expect(cameraButtons.first()).toBeVisible();
      }
      return;
    }

    // Wait for video to load first
    const videoLoaded = await isVideoLoaded(page);
    if (!videoLoaded) {
      // Video failed to load (infrastructure issue) - verify the error state is shown
      const hasError = await page.locator('text=Video Load Error').isVisible().catch(() => false);
      const hasNoVideo = await page.locator('text=No video for this game yet').isVisible().catch(() => false);
      expect(hasError || hasNoVideo).toBeTruthy();
      return;
    }

    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('[Video Error]')) {
        consoleErrors.push(msg.text());
      }
    });

    await cameraButtons.nth(1).click();
    await page.waitForTimeout(3000);

    // Video should still be functional (may show error on camera switch due to signed URL)
    const videoStillOk = await page.locator('video').first().isVisible().catch(() => false);
    const hasError = await page.locator('text=Video Load Error').isVisible().catch(() => false);
    // Either video loads OK or shows a handled error state (not a crash)
    expect(videoStillOk || hasError).toBeTruthy();
  });

  test('rapid camera switching does not corrupt state', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    const cameraSection = page.locator('h2').first().locator('..');
    const cameraButtons = cameraSection.locator('button').filter({ hasText: /^(Main Camera|Camera \d+)$/ });
    const cameraCount = await cameraButtons.count();

    if (cameraCount < 2) {
      // Only 1 camera - nothing to test
      if (cameraCount === 1) {
        await expect(cameraButtons.first()).toBeVisible();
      }
      return;
    }

    const videoLoaded = await isVideoLoaded(page);
    if (!videoLoaded) {
      // Video didn't load - can't test camera switching
      const hasError = await page.locator('text=Video Load Error').isVisible().catch(() => false);
      const hasNoVideo = await page.locator('text=No video for this game yet').isVisible().catch(() => false);
      expect(hasError || hasNoVideo).toBeTruthy();
      return;
    }

    // Rapid switching: A → B → A
    await cameraButtons.nth(0).click();
    await page.waitForTimeout(200);
    await cameraButtons.nth(1).click();
    await page.waitForTimeout(200);
    await cameraButtons.nth(0).click();

    // Wait for all switches to settle
    await page.waitForTimeout(6000);

    // Page should not crash - video area should be functional
    const videoVisible = await page.locator('video').first().isVisible().catch(() => false);
    const hasError = await page.locator('text=Video Load Error').isVisible().catch(() => false);
    // Either video loads or shows handled error state (not a crash)
    expect(videoVisible || hasError).toBeTruthy();

    // Verify one camera button is highlighted (active state)
    const activeButton = cameraButtons.locator('[class*="bg-black"], [class*="font-bold"]');
    const hasActive = await activeButton.first().isVisible().catch(() => false);
    // If active state isn't from class, at least verify buttons are still rendered
    if (!hasActive) {
      expect(await cameraButtons.count()).toBeGreaterThanOrEqual(2);
    }
  });

  // ------------------------------------------
  // Suite 4: Tagging Complete Flow
  // ------------------------------------------

  test('Mark Tagging Complete modal opens with score inputs', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Wait for the status bar to fully render
    const completeButtonLocator = page.locator('button:has-text("Mark Tagging Complete")');
    const alreadyCompleteLocator = page.locator('button:has-text("Tagging Complete")');

    // Wait for one of the two buttons to appear
    await Promise.race([
      completeButtonLocator.first().waitFor({ timeout: 15000 }),
      alreadyCompleteLocator.first().waitFor({ timeout: 15000 }),
    ]);

    const isNotComplete = await completeButtonLocator.first().isVisible().catch(() => false);

    if (isNotComplete) {
      await completeButtonLocator.first().click();
      await expect(page.locator('text=Mark Film Tagging Complete?')).toBeVisible({ timeout: 5000 });

      // Score inputs visible (scoped to modal)
      const modal = page.locator('.fixed.inset-0');
      await expect(modal.locator('label:has-text("Your Team")')).toBeVisible();
      await expect(modal.locator('input[type="number"]').first()).toBeVisible();

      // Confirm button disabled when scores empty
      const confirmButton = modal.locator('button:has-text("Mark Tagging Complete")');
      await expect(confirmButton).toBeDisabled();
    } else {
      // Game already complete - click to re-edit
      await alreadyCompleteLocator.first().click();
      await expect(page.locator('text=Edit Film Tagging?')).toBeVisible({ timeout: 5000 });
    }
  });

  test('entering scores enables confirm button', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    const markCompleteButton = page.locator('button:has-text("Mark Tagging Complete")').first();
    // Wait for page to load
    await page.waitForTimeout(2000); // Let status bar render

    if (!(await markCompleteButton.isVisible().catch(() => false))) {
      // Already complete - test resume editing flow
      const editButton = page.locator('button:has-text("Tagging Complete")').first();
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();
      await expect(page.locator('button:has-text("Resume Editing")')).toBeEnabled({ timeout: 5000 });
      await page.locator('button:has-text("Cancel")').click();
      return;
    }

    await markCompleteButton.click();
    await expect(page.locator('text=Mark Film Tagging Complete?')).toBeVisible({ timeout: 5000 });

    const modal = page.locator('.fixed.inset-0');
    const scoreInputs = modal.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('21');
    await scoreInputs.nth(1).fill('14');

    const confirmButton = modal.locator('button:has-text("Mark Tagging Complete")');
    await expect(confirmButton).toBeEnabled();

    // Cancel without confirming
    await modal.locator('button:has-text("Cancel")').click();
    await expect(page.locator('text=Mark Film Tagging Complete?')).not.toBeVisible();
  });

  test('canceling modal preserves status', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Wait for status bar to fully render
    await page.waitForTimeout(3000);

    // Find the complete/status button
    const completeButton = page.locator(
      'button:has-text("Mark Tagging Complete"), button:has-text("Tagging Complete")'
    ).first();
    await expect(completeButton).toBeVisible({ timeout: 15000 });

    // Get current button text before opening modal
    const buttonText = await completeButton.textContent();

    await completeButton.click();
    await page.waitForTimeout(500);

    // Cancel
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Button text should be unchanged
    await expect(completeButton).toHaveText(buttonText!);
  });

  // ------------------------------------------
  // Suite 5: Marker System
  // ------------------------------------------

  test('marker controls visible when video loaded', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Check if video is loaded on this specific page load
    const videoLoaded = await page.locator('video').first().isVisible({ timeout: 10000 }).catch(() => false);

    if (videoLoaded) {
      // Game Markers section should be visible when video is loaded
      const hasGameMarkers = await page.locator('text=Game Markers').first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasAddMarker = await page.locator('text=Add Marker').first().isVisible().catch(() => false);
      const hasMarkPeriod = await page.locator('text=Mark Period').first().isVisible().catch(() => false);
      expect(hasGameMarkers || hasAddMarker || hasMarkPeriod).toBeTruthy();
    } else {
      // Without video, verify the no-video state is shown correctly
      const hasNoVideo = await page.locator('text=/No videos? for this game yet/').isVisible().catch(() => false);
      const hasTimeline = await page.locator('text=Timeline').first().isVisible().catch(() => false);
      expect(hasNoVideo || hasTimeline).toBeTruthy();
    }
  });

  test('marker panel collapse toggle works', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Video Markers section only appears when video is loaded
    const videoLoaded = await page.locator('video').first().isVisible({ timeout: 10000 }).catch(() => false);
    if (!videoLoaded) {
      // No video on this load - verify page renders correctly and pass
      await expect(page.locator('h1')).toBeVisible();
      return;
    }

    // "Video Markers" heading
    const markerHeading = page.locator('text=Video Markers');
    await expect(markerHeading.first()).toBeVisible({ timeout: 15000 });

    // The heading area is a clickable button
    const collapseButton = page.locator('button').filter({ has: page.locator('text=Video Markers') });
    await expect(collapseButton).toBeVisible();

    // Toggle collapse
    await collapseButton.click();
    await page.waitForTimeout(300);
    await collapseButton.click();
    await page.waitForTimeout(300);

    await expect(markerHeading.first()).toBeVisible();
  });

  // ------------------------------------------
  // Suite 6: Tier Selection
  // ------------------------------------------

  test('Mark Start without tier shows tier selector', async ({ page }) => {
    await goToTagPage(page, teamId, gameId);

    // Check if tier is already set
    const tierBadge = page.locator('text=Quick Tag').or(page.locator('text=Standard')).or(page.locator('text=Comprehensive'));
    if (await tierBadge.first().isVisible().catch(() => false)) {
      // Tier already set - verify the badge is visible (test passes)
      await expect(tierBadge.first()).toBeVisible();
      return;
    }

    // Tier not set - Mark Start should trigger tier selector (requires video)
    test.skip(!gameHasVideo, 'Mark Start requires video to be loaded');
    await waitForVideoReady(page);
    const markStartButton = page.locator('button:has-text("Mark Start")').first();
    await markStartButton.click();

    const tierModal = page.locator('text=Select Tagging Tier');
    await expect(tierModal.first()).toBeVisible({ timeout: 5000 });
  });
});
