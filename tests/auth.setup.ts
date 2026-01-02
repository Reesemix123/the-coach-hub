import { test as setup, expect } from '@playwright/test';
import path from 'path';

const OWNER_AUTH_FILE = path.join(__dirname, '.auth/owner.json');
const COACH_AUTH_FILE = path.join(__dirname, '.auth/coach.json');

/**
 * Setup: Authenticate as Owner
 *
 * This runs before all tests in the 'chromium' project.
 * It logs in as the team owner and saves the auth state.
 */
setup('authenticate as owner', async ({ page }) => {
  const email = process.env.TEST_OWNER_EMAIL;
  const password = process.env.TEST_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing test credentials. Set TEST_OWNER_EMAIL and TEST_OWNER_PASSWORD in .env.local'
    );
  }

  // Navigate to login page
  await page.goto('/auth/login');

  // Fill in login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for successful login - should redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });

  // Verify we're logged in by checking for common authenticated UI elements
  // Could be on teams list, team dashboard, or any authenticated page
  await expect(
    page.locator('text=Dashboard')
      .or(page.locator('text=Teams'))
      .or(page.locator('text=Your Teams'))
      .or(page.locator('text=Playbook'))
      .or(page.locator('text=Youth Coach Hub'))
  ).toBeVisible({ timeout: 10000 });

  // Save signed-in state
  await page.context().storageState({ path: OWNER_AUTH_FILE });

  console.log('Owner authentication saved to', OWNER_AUTH_FILE);
});

/**
 * Setup: Authenticate as Coach
 *
 * This runs before all tests in the 'chromium-coach' project.
 * It logs in as a coach (limited permissions) and saves the auth state.
 */
setup('authenticate as coach', async ({ page }) => {
  const email = process.env.TEST_COACH_EMAIL;
  const password = process.env.TEST_COACH_PASSWORD;

  if (!email || !password) {
    // Coach auth is optional - skip if not configured
    console.log('Coach credentials not configured, skipping coach auth setup');
    return;
  }

  // Navigate to login page
  await page.goto('/auth/login');

  // Fill in login form
  await page.fill('input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for successful login - should redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 30000 });

  // Verify we're logged in by checking for common authenticated UI elements
  await expect(
    page.locator('text=Dashboard')
      .or(page.locator('text=Teams'))
      .or(page.locator('text=Your Teams'))
      .or(page.locator('text=Playbook'))
      .or(page.locator('text=Youth Coach Hub'))
  ).toBeVisible({ timeout: 10000 });

  // Save signed-in state
  await page.context().storageState({ path: COACH_AUTH_FILE });

  console.log('Coach authentication saved to', COACH_AUTH_FILE);
});
