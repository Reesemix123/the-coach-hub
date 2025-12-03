/**
 * Screenshot Capture Script for Getting Started Guide
 *
 * Usage:
 *   EMAIL=your@email.com PASSWORD=yourpass npx tsx scripts/capture-screenshots.ts
 *
 * Or run without credentials for public pages only:
 *   npx tsx scripts/capture-screenshots.ts
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://youthcoachhub.com';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots');

interface Screenshot {
  name: string;
  filename: string;
  url?: string;
  requiresAuth: boolean;
  actions?: (page: Page) => Promise<void>;
  waitFor?: string;
}

const screenshots: Screenshot[] = [
  {
    name: 'Homepage',
    filename: '01-homepage.png',
    url: '/',
    requiresAuth: false,
  },
  {
    name: 'Login Page',
    filename: '02-login.png',
    url: '/auth/login',
    requiresAuth: false,
  },
  {
    name: 'Create Team Form',
    filename: '03-create-team.png',
    url: '/setup',
    requiresAuth: true,
    actions: async (page) => {
      // Click the create team button to show the form
      await page.click('text="+ Create New Team"').catch(() => {});
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'Team Dashboard',
    filename: '04-team-dashboard.png',
    requiresAuth: true,
    // Will navigate to first team automatically
  },
  {
    name: 'Film Library',
    filename: '05-film-library.png',
    requiresAuth: true,
    // Append /film to team URL
  },
];

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function login(page: Page): Promise<boolean> {
  if (!EMAIL || !PASSWORD) {
    console.log('No credentials provided. Skipping authenticated screenshots.');
    return false;
  }

  console.log(`Logging in as ${EMAIL}...`);
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect after login
  await page.waitForTimeout(3000);

  // Check if we're still on login page (failed)
  if (page.url().includes('/auth/login')) {
    console.log('Login failed. Check credentials.');
    return false;
  }

  console.log('Login successful!');
  return true;
}

async function captureScreenshot(
  page: Page,
  screenshot: Screenshot,
  teamId?: string
): Promise<void> {
  const filepath = path.join(SCREENSHOT_DIR, screenshot.filename);

  if (screenshot.url) {
    let url = screenshot.url;
    if (teamId && url.includes('[teamId]')) {
      url = url.replace('[teamId]', teamId);
    }
    await page.goto(`${BASE_URL}${url}`);
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Extra wait for animations

  if (screenshot.actions) {
    await screenshot.actions(page);
  }

  if (screenshot.waitFor) {
    await page.waitForSelector(screenshot.waitFor);
  }

  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Captured: ${screenshot.name} -> ${screenshot.filename}`);
}

async function getFirstTeamId(page: Page): Promise<string | null> {
  // Navigate to teams page and get the first team ID from URL redirect
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const url = page.url();
  const match = url.match(/\/teams\/([a-f0-9-]+)/);
  if (match) {
    return match[1];
  }

  // Try going to /teams and clicking the first team
  await page.goto(`${BASE_URL}/teams`);
  await page.waitForLoadState('networkidle');

  // Look for team links
  const teamLink = await page.$('a[href*="/teams/"]');
  if (teamLink) {
    const href = await teamLink.getAttribute('href');
    const teamMatch = href?.match(/\/teams\/([a-f0-9-]+)/);
    if (teamMatch) {
      return teamMatch[1];
    }
  }

  return null;
}

async function main() {
  console.log('Starting screenshot capture...');
  console.log(`Base URL: ${BASE_URL}`);

  await ensureScreenshotDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  let isLoggedIn = false;
  let teamId: string | null = null;

  try {
    // Capture public pages first
    for (const screenshot of screenshots.filter(s => !s.requiresAuth)) {
      await captureScreenshot(page, screenshot);
    }

    // Try to login for authenticated pages
    if (EMAIL && PASSWORD) {
      isLoggedIn = await login(page);

      if (isLoggedIn) {
        teamId = await getFirstTeamId(page);
        console.log(`Found team ID: ${teamId}`);

        // Capture authenticated pages
        for (const screenshot of screenshots.filter(s => s.requiresAuth)) {
          if (screenshot.name === 'Team Dashboard' && teamId) {
            await page.goto(`${BASE_URL}/teams/${teamId}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, screenshot.filename),
              fullPage: false,
            });
            console.log(`Captured: ${screenshot.name}`);
          } else if (screenshot.name === 'Film Library' && teamId) {
            await page.goto(`${BASE_URL}/teams/${teamId}/film`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, screenshot.filename),
              fullPage: false,
            });
            console.log(`Captured: ${screenshot.name}`);
          } else {
            await captureScreenshot(page, screenshot, teamId || undefined);
          }
        }
      }
    } else {
      console.log('\nTo capture authenticated pages, run with:');
      console.log('  EMAIL=your@email.com PASSWORD=yourpass npx tsx scripts/capture-screenshots.ts\n');
    }

    console.log('\nScreenshots saved to: docs/screenshots/');
    console.log('Files captured:');
    const files = fs.readdirSync(SCREENSHOT_DIR);
    files.forEach(f => console.log(`  - ${f}`));

  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

main();
