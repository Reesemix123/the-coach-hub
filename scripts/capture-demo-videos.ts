/**
 * Demo Video Capture Script for Homepage Feature Modals
 *
 * Captures 4 short demo videos showing each feature in action:
 * 1. Digital Playbook - Creating and organizing plays
 * 2. Pro-Level Analytics - Viewing reports and tendencies
 * 3. AI Film Tagging - Uploading and tagging film
 * 4. Game-Day Preparation - Building a game plan
 *
 * Usage:
 *   EMAIL=your@email.com PASSWORD=yourpass npx tsx scripts/capture-demo-videos.ts
 *
 * Or to capture just one feature:
 *   EMAIL=... PASSWORD=... npx tsx scripts/capture-demo-videos.ts --feature=playbook
 *
 * Output:
 *   Videos saved to public/demos/ as .webm files
 *   Convert to MP4 with: ffmpeg -i input.webm -c:v libx264 -crf 23 output.mp4
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
// Use test coach account - NOT admin account
const EMAIL = process.env.DEMO_EMAIL || 'testcoach@youthcoachhub.test';
const PASSWORD = process.env.DEMO_PASSWORD || 'test';

const OUTPUT_DIR = path.join(__dirname, '../public/demos');

// Video settings for smooth capture - FULL screen, not zoomed
const VIDEO_SIZE = { width: 1440, height: 900 };
const SLOW_MO = 30; // Slightly faster for snappier videos

interface DemoConfig {
  id: string;
  name: string;
  filename: string;
  capture: (page: Page, teamId: string) => Promise<void>;
}

// ============================================
// Demo Capture Functions
// ============================================

async function capturePlaybookDemo(page: Page, teamId: string): Promise<void> {
  console.log('  📚 Capturing Digital Playbook demo...');

  // Page is already pre-loaded by captureDemo, just wait for content
  await page.waitForSelector('text=plays', { timeout: 10000 });
  await smoothWait(page, 300);

  // Scroll down to show plays
  await smoothScroll(page, 150);
  await smoothWait(page, 800);

  // Move cursor to Offense tab and click
  const offenseTab = page.locator('button:has-text("Offense")').first();
  if (await offenseTab.isVisible()) {
    const offenseBox = await offenseTab.boundingBox();
    if (offenseBox) {
      await page.mouse.move(offenseBox.x + offenseBox.width / 2, offenseBox.y + offenseBox.height / 2);
      await smoothWait(page, 300);
      await offenseTab.click();
      await smoothWait(page, 800);
    }
  }

  // Move cursor to Defense tab and click
  const defenseTab = page.locator('button:has-text("Defense")').first();
  if (await defenseTab.isVisible()) {
    const defenseBox = await defenseTab.boundingBox();
    if (defenseBox) {
      await page.mouse.move(defenseBox.x + defenseBox.width / 2, defenseBox.y + defenseBox.height / 2);
      await smoothWait(page, 300);
      await defenseTab.click();
      await smoothWait(page, 800);
    }
  }

  // Smooth scroll through defensive plays
  await smoothScroll(page, 120);
  await smoothWait(page, 600);

  // Smooth scroll back up to show Build Play button
  await smoothScrollUp(page, 250);
  await smoothWait(page, 400);

  // Move cursor to "+ Build Play" button and click
  const buildPlayButton = page.locator('button:has-text("Build Play")').first();
  await buildPlayButton.waitFor({ state: 'visible', timeout: 5000 });
  const buildBox = await buildPlayButton.boundingBox();
  if (buildBox) {
    await page.mouse.move(buildBox.x + buildBox.width / 2, buildBox.y + buildBox.height / 2);
    await smoothWait(page, 400);
    await buildPlayButton.click();
  }

  // Wait for Create New Play page to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Create New Play', { timeout: 15000 });
  await smoothWait(page, 500);

  // Move cursor to Play Name input and type with visible cursor
  const playNameInput = page.locator('input').first();
  if (await playNameInput.isVisible()) {
    const nameBox = await playNameInput.boundingBox();
    if (nameBox) {
      await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2);
      await smoothWait(page, 300);
      await playNameInput.click();
      await smoothWait(page, 200);
      // Type letter by letter with visible delay
      await page.keyboard.type('Pro Set 37 Toss Sweep', { delay: 60 });
      await smoothWait(page, 600);
    }
  }

  // Move cursor to Formation dropdown and select Pro Set
  const formationSelect = page.locator('select').nth(1);
  if (await formationSelect.isVisible()) {
    const formBox = await formationSelect.boundingBox();
    if (formBox) {
      await page.mouse.move(formBox.x + formBox.width / 2, formBox.y + formBox.height / 2);
      await smoothWait(page, 300);
      await formationSelect.click();
      await smoothWait(page, 200);
      await formationSelect.selectOption({ label: 'Pro Set' });
      await smoothWait(page, 800);
    }
  }

  // Move cursor to Play Type dropdown and select Run
  const playTypeSelect = page.locator('select').nth(2);
  if (await playTypeSelect.isVisible()) {
    const typeBox = await playTypeSelect.boundingBox();
    if (typeBox) {
      await page.mouse.move(typeBox.x + typeBox.width / 2, typeBox.y + typeBox.height / 2);
      await smoothWait(page, 300);
      await playTypeSelect.click();
      await smoothWait(page, 200);
      await playTypeSelect.selectOption({ label: 'Run' });
      await smoothWait(page, 600);
    }
  }

  // Move cursor to Target Hole dropdown and select 7 (Far Left - Wide)
  const targetHoleSelect = page.locator('select').nth(3);
  if (await targetHoleSelect.isVisible()) {
    const holeBox = await targetHoleSelect.boundingBox();
    if (holeBox) {
      await page.mouse.move(holeBox.x + holeBox.width / 2, holeBox.y + holeBox.height / 2);
      await smoothWait(page, 300);
      await targetHoleSelect.click();
      await smoothWait(page, 200);
      // Select by label to ensure we get hole 7
      await targetHoleSelect.selectOption({ label: '7 (Far Left - Wide)' });
      await smoothWait(page, 600);
    }
  }

  // Move cursor to Ball Carrier dropdown and select HB
  const ballCarrierSelect = page.locator('select').nth(4);
  if (await ballCarrierSelect.isVisible()) {
    const carrierBox = await ballCarrierSelect.boundingBox();
    if (carrierBox) {
      await page.mouse.move(carrierBox.x + carrierBox.width / 2, carrierBox.y + carrierBox.height / 2);
      await smoothWait(page, 300);
      await ballCarrierSelect.click();
      await smoothWait(page, 200);
      // Select RB option (shows as "RB (RB)" in the dropdown)
      await ballCarrierSelect.selectOption({ label: 'RB (RB)' });
      await smoothWait(page, 800);
    }
  }

  // Scroll down to show formation info panel
  await smoothScroll(page, 100);
  await smoothWait(page, 600);

  // Continue scrolling to show Player Assignments section
  await smoothScroll(page, 350);
  await smoothWait(page, 800);

  // Click on "Offensive Line" button to expand it
  // The section is a button element containing h4 with "Offensive Line (X)"
  const offensiveLineButton = page.locator('button:has(h4:has-text("Offensive Line"))').first();
  await offensiveLineButton.waitFor({ state: 'visible', timeout: 5000 });
  const headerBox = await offensiveLineButton.boundingBox();
  if (headerBox) {
    // Move cursor to the button (toward the chevron on the right)
    await page.mouse.move(headerBox.x + headerBox.width - 40, headerBox.y + headerBox.height / 2);
    await smoothWait(page, 500);
    // Click the button to expand
    await offensiveLineButton.click();
    await smoothWait(page, 1000);
  }

  // Scroll down a bit to show the expanded content
  await smoothScroll(page, 150);
  await smoothWait(page, 500);

  // Look for "Apply blocking assignment to all linemen" checkbox and check it
  const applyToAllCheckbox = page.locator('input[type="checkbox"]').first();
  if (await applyToAllCheckbox.isVisible()) {
    const checkboxBox = await applyToAllCheckbox.boundingBox();
    if (checkboxBox) {
      await page.mouse.move(checkboxBox.x + checkboxBox.width / 2, checkboxBox.y + checkboxBox.height / 2);
      await smoothWait(page, 400);
      await applyToAllCheckbox.click();
      await smoothWait(page, 800);
    }
  }

  // Find the Block Type dropdown for LT (first dropdown with "Select...", "Run Block", "Pass Block", "Pull" options)
  // After expanding, scroll to make sure dropdowns are visible
  await smoothScroll(page, 50);
  await smoothWait(page, 500);

  // The LT dropdown should be the first Block Type select visible after the checkbox
  // Find all selects in the page that have "Run Block" as an option
  const allSelects = page.locator('select');
  const selectCount = await allSelects.count();

  // Look for a select that contains "Run Block" option (Block Type dropdown)
  for (let i = 0; i < selectCount; i++) {
    const select = allSelects.nth(i);
    const html = await select.innerHTML().catch(() => '');
    if (html.includes('Run Block') && await select.isVisible()) {
      const dropdownBox = await select.boundingBox();
      if (dropdownBox) {
        // Move cursor to the dropdown
        await page.mouse.move(dropdownBox.x + dropdownBox.width / 2, dropdownBox.y + dropdownBox.height / 2);
        await smoothWait(page, 500);
        // Click to open the dropdown
        await select.click();
        await smoothWait(page, 400);
        // Select "Run Block"
        await select.selectOption({ label: 'Run Block' });
        await smoothWait(page, 1200);
        break; // Only do the first one (LT)
      }
    }
  }

  // Scroll down a bit more to show all linemen with Run Block applied
  await smoothScroll(page, 100);
  await smoothWait(page, 800);

  // Move mouse over the play diagram to highlight it
  await page.mouse.move(1000, 350);
  await smoothWait(page, 1000);

  console.log('  ✅ Playbook demo complete');
}

async function captureAnalyticsDemo(page: Page, teamId: string): Promise<void> {
  console.log('  📊 Capturing Pro-Level Analytics demo...');

  // Page is already pre-loaded by captureDemo at analytics-reporting
  // Wait for the page to be fully ready
  await page.waitForSelector('text=Season Overview', { timeout: 10000 });
  await smoothWait(page, 500);

  // Step 1: Select Week 1 in the Game dropdown (has data in seed)
  const gameDropdown = page.locator('select').first();
  await gameDropdown.waitFor({ state: 'visible', timeout: 5000 });
  const gameBox = await gameDropdown.boundingBox();
  if (gameBox) {
    await page.mouse.move(gameBox.x + gameBox.width / 2, gameBox.y + gameBox.height / 2);
    await smoothWait(page, 300);
    await gameDropdown.click();
    await smoothWait(page, 200);
    // Select Week 1 - Lincoln Lions (has play data in seed)
    await gameDropdown.selectOption({ label: 'Week 1 - Lincoln Lions' });
    await smoothWait(page, 300);
  }

  // Wait for "This Game" report to load
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 800);

  // Step 2: Scroll through the "This Game" (single game) report
  await smoothScroll(page, 250);
  await smoothWait(page, 500);
  await smoothScroll(page, 250);
  await smoothWait(page, 500);
  await smoothScroll(page, 200);
  await smoothWait(page, 600);

  // Scroll back up to show the filter toggle
  await smoothScrollUp(page, 600);
  await smoothWait(page, 400);

  // Step 3: Click "Through Week" toggle
  const throughWeekButton = page.locator('button:has-text("Through Week")').first();
  await throughWeekButton.waitFor({ state: 'visible', timeout: 5000 });
  const throughWeekBox = await throughWeekButton.boundingBox();
  if (throughWeekBox) {
    await page.mouse.move(throughWeekBox.x + throughWeekBox.width / 2, throughWeekBox.y + throughWeekBox.height / 2);
    await smoothWait(page, 300);
    await throughWeekButton.click();
  }

  // Wait for cumulative report to load
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 800);

  // Step 4: Scroll through the "Through Week" (cumulative) report
  await smoothScroll(page, 250);
  await smoothWait(page, 500);
  await smoothScroll(page, 250);
  await smoothWait(page, 500);
  await smoothScroll(page, 200);
  await smoothWait(page, 600);

  // Scroll back up to top
  await smoothScrollUp(page, 600);
  await smoothWait(page, 400);

  // Step 5: Select Opponent Scouting report from the report selector
  // Find the report selector dropdown (likely a select or button group)
  const reportSelector = page.locator('select:has(option:has-text("Opponent Scouting"))').first();
  if (await reportSelector.isVisible()) {
    const reportBox = await reportSelector.boundingBox();
    if (reportBox) {
      await page.mouse.move(reportBox.x + reportBox.width / 2, reportBox.y + reportBox.height / 2);
      await smoothWait(page, 300);
      await reportSelector.click();
      await smoothWait(page, 200);
      await reportSelector.selectOption({ label: 'Opponent Scouting' });
      await smoothWait(page, 300);
    }
  } else {
    // Try clicking a button/tab with "Opponent Scouting" text
    const opponentTab = page.locator('button:has-text("Opponent Scouting"), [role="tab"]:has-text("Opponent Scouting")').first();
    if (await opponentTab.isVisible()) {
      const tabBox = await opponentTab.boundingBox();
      if (tabBox) {
        await page.mouse.move(tabBox.x + tabBox.width / 2, tabBox.y + tabBox.height / 2);
        await smoothWait(page, 300);
        await opponentTab.click();
      }
    }
  }

  // Wait for Opponent Scouting report to load
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 800);

  // Step 6: Select Lincoln Lions in the opponent filter
  // The Opponent Scouting report has its own dropdown with format "Lincoln Lions (X plays)"
  // Wait for the opponent selector to appear (labeled "Select Opponent")
  await page.waitForSelector('label:has-text("Select Opponent")', { timeout: 5000 });
  const opponentDropdown = page.locator('select').first();
  await opponentDropdown.waitFor({ state: 'visible', timeout: 5000 });
  const opponentBox = await opponentDropdown.boundingBox();
  if (opponentBox) {
    await page.mouse.move(opponentBox.x + opponentBox.width / 2, opponentBox.y + opponentBox.height / 2);
    await smoothWait(page, 300);
    await opponentDropdown.click();
    await smoothWait(page, 200);
    // Select by value (the opponent name) since label includes play count
    await opponentDropdown.selectOption({ value: 'Lincoln Lions' });
    await smoothWait(page, 300);
  }

  // Wait for opponent report to load
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 1000);

  // Step 7: Scroll through the Opponent Scouting report
  await smoothScroll(page, 200);
  await smoothWait(page, 600);
  await smoothScroll(page, 200);
  await smoothWait(page, 800);

  console.log('  ✅ Analytics demo complete');
}

async function captureFilmDemo(page: Page, teamId: string): Promise<void> {
  console.log('  🎬 Capturing AI Film Tagging demo...');

  // Navigate to film library
  await page.goto(`${BASE_URL}/teams/${teamId}/film`);
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 1500);

  // Show the film list
  await smoothScroll(page, 200);
  await smoothWait(page, 1000);

  // Click on a game if available
  const gameCard = page.locator('a[href*="/film/"]').first();
  if (await gameCard.isVisible()) {
    await gameCard.click();
    await page.waitForLoadState('networkidle');
    await smoothWait(page, 2000);

    // Navigate to tagging view if available
    const tagButton = page.locator('a:has-text("Tag"), button:has-text("Tag")').first();
    if (await tagButton.isVisible()) {
      await tagButton.click();
      await page.waitForLoadState('networkidle');
      await smoothWait(page, 2000);

      // Show the tagging form
      await smoothScroll(page, 150);
      await smoothWait(page, 1500);

      // Click on AI assist button if visible
      const aiButton = page.locator('button:has-text("AI"), button:has-text("Assist")').first();
      if (await aiButton.isVisible()) {
        await aiButton.click();
        await smoothWait(page, 2000);
      }
    }
  }

  // Navigate to schedule to show game creation flow
  await page.goto(`${BASE_URL}/teams/${teamId}/schedule`);
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 1500);

  console.log('  ✅ Film demo complete');
}

async function captureGamePrepDemo(page: Page, teamId: string): Promise<void> {
  console.log('  📋 Capturing Game-Day Preparation demo...');

  // Navigate to game week / game plan hub
  await page.goto(`${BASE_URL}/teams/${teamId}/game-week`);
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 2000);

  // Scroll to show content
  await smoothScroll(page, 200);
  await smoothWait(page, 1000);

  // Look for game plan options
  const planButton = page.locator('button:has-text("Plan"), a:has-text("Plan")').first();
  if (await planButton.isVisible()) {
    await planButton.click();
    await page.waitForLoadState('networkidle');
    await smoothWait(page, 1500);
  }

  // Try game prep hub
  try {
    await page.goto(`${BASE_URL}/teams/${teamId}/game-prep-hub`);
    await page.waitForLoadState('networkidle');
    await smoothWait(page, 2000);
    await smoothScroll(page, 250);
    await smoothWait(page, 1000);
  } catch {
    // Page might not exist
  }

  // Navigate to strategy assistant
  await page.goto(`${BASE_URL}/teams/${teamId}/strategy-assistant`);
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 1500);

  // Interact with strategy options
  const strategyButton = page.locator('button').first();
  if (await strategyButton.isVisible()) {
    await strategyButton.click();
    await smoothWait(page, 1000);
  }

  // Show practice planning
  await page.goto(`${BASE_URL}/teams/${teamId}/practice`);
  await page.waitForLoadState('networkidle');
  await smoothWait(page, 1500);

  console.log('  ✅ Game prep demo complete');
}

// ============================================
// Demo Configurations
// ============================================

const DEMOS: DemoConfig[] = [
  {
    id: 'playbook',
    name: 'Digital Playbook',
    filename: 'digital-playbook.webm',
    capture: capturePlaybookDemo,
  },
  {
    id: 'analytics',
    name: 'Pro-Level Analytics',
    filename: 'pro-analytics.webm',
    capture: captureAnalyticsDemo,
  },
  {
    id: 'film',
    name: 'AI Film Tagging',
    filename: 'ai-film-tagging.webm',
    capture: captureFilmDemo,
  },
  {
    id: 'gameprep',
    name: 'Game-Day Preparation',
    filename: 'game-day-prep.webm',
    capture: captureGamePrepDemo,
  },
];

// ============================================
// Helper Functions
// ============================================

async function smoothWait(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

async function smoothScroll(page: Page, amount: number): Promise<void> {
  // Scroll down in small increments for smooth animation
  const steps = 15;
  const stepAmount = amount / steps;

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepAmount);
    await page.waitForTimeout(40);
  }
}

async function smoothScrollUp(page: Page, amount: number): Promise<void> {
  // Scroll up in small increments for smooth animation
  const steps = 15;
  const stepAmount = amount / steps;

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -stepAmount);
    await page.waitForTimeout(40);
  }
}

async function ensureOutputDir(): Promise<void> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function login(page: Page): Promise<boolean> {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ Missing credentials. Set EMAIL and PASSWORD environment variables.');
    return false;
  }

  console.log(`🔐 Logging in as ${EMAIL}...`);
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Extra wait for page to settle

  // Fill form
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  await page.waitForTimeout(500);

  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL((url) => !url.toString().includes('/auth/login'), { timeout: 10000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  // Additional wait for redirect to complete
  await page.waitForTimeout(2000);

  // Check if we're still on login page (failed)
  if (page.url().includes('/auth/login')) {
    console.error('❌ Login failed. Check credentials.');
    return false;
  }

  console.log('✅ Login successful!');
  return true;
}

async function getFirstTeamId(page: Page): Promise<string | null> {
  // Check current URL first
  const currentUrl = page.url();
  const match = currentUrl.match(/\/teams\/([a-f0-9-]+)/);
  if (match) {
    return match[1];
  }

  // Navigate to root and see where we end up
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const newUrl = page.url();
  const redirectMatch = newUrl.match(/\/teams\/([a-f0-9-]+)/);
  if (redirectMatch) {
    return redirectMatch[1];
  }

  // Try teams page
  await page.goto(`${BASE_URL}/teams`);
  await page.waitForLoadState('networkidle');

  const teamLink = page.locator('a[href*="/teams/"]').first();
  const href = await teamLink.getAttribute('href').catch(() => null);

  if (href) {
    const teamMatch = href.match(/\/teams\/([a-f0-9-]+)/);
    return teamMatch ? teamMatch[1] : null;
  }

  return null;
}

async function captureDemo(
  browser: Browser,
  demo: DemoConfig,
  teamId: string
): Promise<void> {
  const videoPath = path.join(OUTPUT_DIR, demo.filename);

  console.log(`\n🎥 Recording: ${demo.name}`);
  console.log(`   Output: ${demo.filename}`);

  // Step 1: Login and PRE-LOAD the starting page (no recording yet)
  console.log('   🔐 Logging in and pre-loading...');
  const loginContext = await browser.newContext({ viewport: VIDEO_SIZE });
  const loginPage = await loginContext.newPage();

  const loggedIn = await login(loginPage);
  if (!loggedIn) {
    await loginContext.close();
    throw new Error('Login failed');
  }

  // Pre-navigate to the starting page and wait for it to fully load
  // This ensures when recording starts, the page is already loaded
  const startingUrl = getStartingUrl(demo.id, teamId);
  await loginPage.goto(startingUrl);
  await loginPage.waitForLoadState('networkidle');
  // Wait for content to render (not just "Loading...")
  await loginPage.waitForTimeout(2000);

  // Save the session state (cookies, localStorage)
  const storageState = await loginContext.storageState();
  await loginContext.close();

  // Step 2: Create recording context with saved session
  const recordingContext = await browser.newContext({
    viewport: VIDEO_SIZE,
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIDEO_SIZE,
    },
    storageState, // Use saved session - already logged in!
  });

  const page = await recordingContext.newPage();

  try {
    // Navigate to the starting page - should be instant since it's cached/preloaded
    await page.goto(startingUrl);
    await page.waitForLoadState('domcontentloaded');
    // Small delay to ensure page is fully rendered before recording shows
    await page.waitForTimeout(300);

    console.log('   🎬 Recording started...');

    // Run the demo capture (starts from already-loaded page)
    await demo.capture(page, teamId);

    // Wait a moment before closing
    await page.waitForTimeout(500);

  } finally {
    // Close context to save video
    await recordingContext.close();

    // Rename the video file (Playwright generates random names)
    const files = fs.readdirSync(OUTPUT_DIR);
    const latestVideo = files
      .filter(f => f.endsWith('.webm') && !DEMOS.some(d => d.filename === f))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(OUTPUT_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];

    if (latestVideo) {
      const oldPath = path.join(OUTPUT_DIR, latestVideo.name);
      const newPath = path.join(OUTPUT_DIR, demo.filename);

      // Remove existing file if it exists
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
      }

      fs.renameSync(oldPath, newPath);
      console.log(`   ✅ Saved: ${demo.filename}`);
    }
  }
}

// Get the starting URL for each demo
function getStartingUrl(demoId: string, teamId: string): string {
  switch (demoId) {
    case 'playbook':
      return `${BASE_URL}/teams/${teamId}/playbook`;
    case 'analytics':
      return `${BASE_URL}/teams/${teamId}/analytics-reporting`;
    case 'film':
      return `${BASE_URL}/teams/${teamId}/film`;
    case 'gameprep':
      return `${BASE_URL}/teams/${teamId}/game-week`;
    default:
      return `${BASE_URL}/teams/${teamId}`;
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main(): Promise<void> {
  console.log('🎬 Demo Video Capture Script');
  console.log('============================\n');

  // Check for single feature flag
  const featureArg = process.argv.find(arg => arg.startsWith('--feature='));
  const singleFeature = featureArg?.split('=')[1];

  if (!EMAIL || !PASSWORD) {
    console.error('❌ Missing credentials!\n');
    console.error('Usage:');
    console.error('  EMAIL=your@email.com PASSWORD=yourpass npx tsx scripts/capture-demo-videos.ts\n');
    process.exit(1);
  }

  await ensureOutputDir();

  // Launch browser with slowmo for smoother recordings
  const browser = await chromium.launch({
    headless: true,
    slowMo: SLOW_MO,
  });

  try {
    // First, login to get team ID
    const tempContext = await browser.newContext({ viewport: VIDEO_SIZE });
    const tempPage = await tempContext.newPage();

    const loggedIn = await login(tempPage);
    if (!loggedIn) {
      process.exit(1);
    }

    const teamId = await getFirstTeamId(tempPage);
    if (!teamId) {
      console.error('❌ No team found. Please ensure you have at least one team.');
      process.exit(1);
    }

    console.log(`📂 Using team ID: ${teamId}`);
    await tempContext.close();

    // Filter demos if single feature requested
    const demosToCapture = singleFeature
      ? DEMOS.filter(d => d.id === singleFeature)
      : DEMOS;

    if (singleFeature && demosToCapture.length === 0) {
      console.error(`❌ Unknown feature: ${singleFeature}`);
      console.error(`   Available: ${DEMOS.map(d => d.id).join(', ')}`);
      process.exit(1);
    }

    // Capture each demo with delay between to avoid rate limiting
    for (let i = 0; i < demosToCapture.length; i++) {
      const demo = demosToCapture[i];
      await captureDemo(browser, demo, teamId);

      // Wait 3 seconds between demos to avoid auth rate limiting
      if (i < demosToCapture.length - 1) {
        console.log('   ⏳ Waiting before next capture...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n============================');
    console.log('🎉 All demos captured!\n');
    console.log('Output files:');

    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm'));
    files.forEach(f => console.log(`  📹 public/demos/${f}`));

    console.log('\n📝 To convert to MP4 (recommended for browser compatibility):');
    console.log('   ffmpeg -i public/demos/digital-playbook.webm -c:v libx264 -crf 23 public/demos/digital-playbook.mp4');

  } catch (error) {
    console.error('❌ Error capturing demos:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
