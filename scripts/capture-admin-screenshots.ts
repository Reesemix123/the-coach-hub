/**
 * Platform Admin Console Screenshot Capture Script
 * Captures all admin features for the Admin User Guide
 */

import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://youthcoachhub.com';
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots/admin');

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

async function capture(page: Page, filename: string, description: string) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  ✓ ${description} -> ${filename}`);
}

async function main() {
  console.log('Starting Platform Admin screenshot capture...\n');
  await ensureScreenshotDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // === LOGIN ===
    if (!EMAIL || !PASSWORD) {
      console.log('Provide EMAIL and PASSWORD env vars for admin screenshots.');
      await browser.close();
      return;
    }

    const loggedIn = await login(page);
    if (!loggedIn) {
      await browser.close();
      return;
    }

    // === ADMIN DASHBOARD ===
    console.log('\n--- Admin Dashboard ---');
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for dashboard data to load
    await capture(page, 'admin-01-dashboard.png', 'Admin Dashboard');

    // === ORGANIZATIONS ===
    console.log('\n--- Organizations ---');
    await page.goto(`${BASE_URL}/admin/organizations`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-02-organizations.png', 'Organizations List');

    // === USERS ===
    console.log('\n--- Users ---');
    await page.goto(`${BASE_URL}/admin/users`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-03-users.png', 'Users List');

    // === BILLING/REVENUE ===
    console.log('\n--- Revenue ---');
    await page.goto(`${BASE_URL}/admin/billing`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-04-revenue.png', 'Revenue Dashboard');

    // === COSTS ===
    console.log('\n--- Costs ---');
    await page.goto(`${BASE_URL}/admin/costs`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-05-costs.png', 'AI Costs Tracking');

    // === LOGS ===
    console.log('\n--- Logs ---');
    await page.goto(`${BASE_URL}/admin/logs`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-06-logs.png', 'Logs Dashboard');

    // === MODERATION ===
    console.log('\n--- Moderation ---');
    await page.goto(`${BASE_URL}/admin/moderation`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-07-moderation.png', 'Content Moderation');

    // === SYSTEM - Feature Flags ===
    console.log('\n--- System Settings ---');
    await page.goto(`${BASE_URL}/admin/system`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await capture(page, 'admin-08-system-flags.png', 'Feature Flags');

    // === SYSTEM - Tier Config ===
    const tierTab = await page.$('button:has-text("Tier Config")');
    if (tierTab) {
      await tierTab.click();
      await page.waitForTimeout(1000);
      await capture(page, 'admin-09-system-tiers.png', 'Tier Configuration');
    }

    // === SYSTEM - Trial Settings ===
    const trialTab = await page.$('button:has-text("Trial Settings")');
    if (trialTab) {
      await trialTab.click();
      await page.waitForTimeout(1000);
      await capture(page, 'admin-10-system-trial.png', 'Trial Settings');
    }

    // === SYSTEM - System Health ===
    const healthTab = await page.$('button:has-text("System Health")');
    if (healthTab) {
      await healthTab.click();
      await page.waitForTimeout(1000);
      await capture(page, 'admin-11-system-health.png', 'System Health');
    }

    // === SYSTEM - Storage ===
    const storageTab = await page.$('button:has-text("Storage")');
    if (storageTab) {
      await storageTab.click();
      await page.waitForTimeout(1000);
      await capture(page, 'admin-12-system-storage.png', 'Storage Settings');
    }

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
