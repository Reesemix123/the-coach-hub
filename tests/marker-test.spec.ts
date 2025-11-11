import { test, expect } from '@playwright/test';

/**
 * Video Marker System Test
 *
 * Tests the complete marker workflow:
 * 1. Navigate to film page
 * 2. Add a marker
 * 3. Verify marker appears on timeline
 * 4. Click marker to jump
 * 5. Delete marker
 */

test.describe('Video Marker System', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3002/auth/login');

    // Use test credentials (adjust as needed)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');

    // Wait for redirect to home
    await page.waitForURL(/\/$/);
  });

  test('should add a marker at current time', async ({ page }) => {
    // Navigate to a game film page
    // Note: You'll need to replace this with an actual game ID from your database
    await page.goto('http://localhost:3002/teams/YOUR_TEAM_ID/film/YOUR_GAME_ID');

    // Wait for video to load
    await page.waitForSelector('video');

    // Play video for 5 seconds to get to a timestamp
    await page.click('video');
    await page.waitForTimeout(5000);
    await page.click('video'); // Pause

    // Click "Add Marker" button
    await page.click('button:has-text("Add Marker")');

    // Wait for marker to be created
    await page.waitForTimeout(1000);

    // Open marker panel
    await page.click('button:has-text("Markers")');

    // Verify marker appears in list
    const markerList = page.locator('[class*="MarkerList"]');
    await expect(markerList).toBeVisible();

    // Verify at least one marker exists
    const markers = page.locator('[class*="marker"]');
    await expect(markers.first()).toBeVisible();
  });

  test('should display markers on timeline', async ({ page }) => {
    await page.goto('http://localhost:3002/teams/YOUR_TEAM_ID/film/YOUR_GAME_ID');

    // Wait for video to load
    await page.waitForSelector('video');

    // Add a marker
    await page.click('button:has-text("Add Marker")');
    await page.waitForTimeout(1000);

    // Check if marker appears on timeline (vertical line)
    const timelineMarker = page.locator('[class*="VideoTimelineMarkers"]');
    await expect(timelineMarker).toBeVisible();
  });

  test('should jump to marker when clicked', async ({ page }) => {
    await page.goto('http://localhost:3002/teams/YOUR_TEAM_ID/film/YOUR_GAME_ID');

    // Wait for video to load
    await page.waitForSelector('video');

    // Add marker at 10 seconds
    const video = page.locator('video');
    await video.evaluate((v: HTMLVideoElement) => v.currentTime = 10);
    await page.waitForTimeout(500);

    await page.click('button:has-text("Add Marker")');
    await page.waitForTimeout(1000);

    // Move to different time
    await video.evaluate((v: HTMLVideoElement) => v.currentTime = 0);

    // Open marker panel
    await page.click('button:has-text("Markers")');

    // Click the jump button
    await page.click('button[title="Jump to marker"]');

    // Verify video jumped to marker time (around 10 seconds)
    const currentTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(currentTime).toBeGreaterThan(9);
    expect(currentTime).toBeLessThan(11);
  });

  test('should delete marker', async ({ page }) => {
    await page.goto('http://localhost:3002/teams/YOUR_TEAM_ID/film/YOUR_GAME_ID');

    // Wait for video to load
    await page.waitForSelector('video');

    // Add a marker
    await page.click('button:has-text("Add Marker")');
    await page.waitForTimeout(1000);

    // Open marker panel
    await page.click('button:has-text("Markers")');

    // Count initial markers
    const markersBefore = await page.locator('[class*="marker"]').count();

    // Hover over marker to reveal delete button
    await page.hover('[class*="marker"]');

    // Click delete button
    await page.click('button[title="Delete marker"]');
    await page.waitForTimeout(1000);

    // Verify marker count decreased
    const markersAfter = await page.locator('[class*="marker"]').count();
    expect(markersAfter).toBe(markersBefore - 1);
  });
});
