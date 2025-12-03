/**
 * Comprehensive Screenshot Capture Script
 * Captures all main features for the Getting Started Guide
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://youthcoachhub.com';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots');

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function login(page: Page): Promise<boolean> {
  if (!EMAIL || !PASSWORD) {
    console.log('No credentials provided.');
    return false;
  }

  console.log(`Logging in as ${EMAIL}...`);
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  if (page.url().includes('/auth/login')) {
    console.log('Login failed.');
    return false;
  }

  console.log('Login successful!');
  return true;
}

async function getTeamId(page: Page): Promise<string | null> {
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const url = page.url();
  const match = url.match(/\/teams\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

async function capture(page: Page, filename: string, description: string) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`✓ ${description} -> ${filename}`);
}

async function main() {
  console.log('Starting comprehensive screenshot capture...\n');
  await ensureScreenshotDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // === PUBLIC PAGES ===
    console.log('--- Public Pages ---');

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await capture(page, '01-homepage.png', 'Homepage');

    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForLoadState('networkidle');
    await capture(page, '02-login.png', 'Login Page');

    // === LOGIN ===
    if (!EMAIL || !PASSWORD) {
      console.log('\nProvide EMAIL and PASSWORD env vars for authenticated pages.');
      await browser.close();
      return;
    }

    const loggedIn = await login(page);
    if (!loggedIn) {
      await browser.close();
      return;
    }

    const teamId = await getTeamId(page);
    if (!teamId) {
      console.log('Could not find team ID');
      await browser.close();
      return;
    }
    console.log(`\nUsing team ID: ${teamId}\n`);

    // === TEAM SETUP ===
    console.log('--- Team Setup ---');

    await page.goto(`${BASE_URL}/setup`);
    await page.waitForLoadState('networkidle');
    // Click create team button if visible
    const createBtn = await page.$('text="+ Create New Team"');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(500);
    }
    await capture(page, '03-create-team.png', 'Create Team Form');

    // === DASHBOARD ===
    console.log('--- Dashboard ---');

    await page.goto(`${BASE_URL}/teams/${teamId}`);
    await page.waitForLoadState('networkidle');
    await capture(page, '04-dashboard.png', 'Team Dashboard');

    // === SCHEDULE ===
    console.log('--- Schedule ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/schedule`);
    await page.waitForLoadState('networkidle');
    await capture(page, '05-schedule.png', 'Schedule Page');

    // Try to click Add Game to show the form
    const addGameBtn = await page.$('text="Add Game"');
    if (addGameBtn) {
      await addGameBtn.click();
      await page.waitForTimeout(500);
      await capture(page, '06-add-game-form.png', 'Add Game Form');
      // Close modal
      const closeBtn = await page.$('text="Cancel"');
      if (closeBtn) await closeBtn.click();
    }

    // === ROSTER/PLAYERS ===
    console.log('--- Roster ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/players`);
    await page.waitForLoadState('networkidle');
    await capture(page, '07-roster.png', 'Roster Page');

    // Try to show add player form
    const addPlayerBtn = await page.$('text="Add Player"');
    if (addPlayerBtn) {
      await addPlayerBtn.click();
      await page.waitForTimeout(500);
      await capture(page, '08-add-player-form.png', 'Add Player Form');
      const cancelBtn = await page.$('text="Cancel"');
      if (cancelBtn) await cancelBtn.click();
    }

    // === PLAYBOOK ===
    console.log('--- Playbook ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/playbook`);
    await page.waitForLoadState('networkidle');
    await capture(page, '09-playbook.png', 'Playbook Page');

    // Go to create new play
    await page.goto(`${BASE_URL}/teams/${teamId}/playbook/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // Wait for play builder to load
    await capture(page, '10-play-builder.png', 'Play Builder');

    // === FILM LIBRARY ===
    console.log('--- Film ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/film`);
    await page.waitForLoadState('networkidle');
    await capture(page, '11-film-library.png', 'Film Library');

    // Try to find a game with film and go to it
    const viewFilmBtn = await page.$('text="View Film"');
    if (viewFilmBtn) {
      await viewFilmBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await capture(page, '12-film-viewer.png', 'Film Viewer');

      // Look for play tagging form
      const tagPlaySection = await page.$('[class*="tag"], [class*="form"]');
      if (tagPlaySection) {
        await capture(page, '13-play-tagging.png', 'Play Tagging Form');
      }
    }

    // === ANALYTICS ===
    console.log('--- Analytics ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/analytics-reporting`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await capture(page, '14-analytics.png', 'Analytics Dashboard');

    // === GAME PLANNING ===
    console.log('--- Game Planning ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/game-prep-hub`);
    await page.waitForLoadState('networkidle');
    await capture(page, '15-game-prep.png', 'Game Prep Hub');

    await page.goto(`${BASE_URL}/teams/${teamId}/game-week`);
    await page.waitForLoadState('networkidle');
    await capture(page, '16-game-week.png', 'Game Week');

    // === PRACTICE PLANNING ===
    console.log('--- Practice ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/practice`);
    await page.waitForLoadState('networkidle');
    await capture(page, '17-practice.png', 'Practice Plans');

    // === SETTINGS ===
    console.log('--- Settings ---');

    await page.goto(`${BASE_URL}/teams/${teamId}/settings`);
    await page.waitForLoadState('networkidle');
    await capture(page, '18-settings.png', 'Team Settings');

    // === SUMMARY ===
    console.log('\n--- Complete! ---');
    const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    console.log(`\nCaptured ${files.length} screenshots:`);
    files.sort().forEach(f => console.log(`  ${f}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
