/**
 * Test Feature Demo Modals
 *
 * Tests that:
 * 1. Feature cards are clickable
 * 2. Modals open correctly
 * 3. Videos load and play
 * 4. Mobile viewport works correctly
 *
 * Usage:
 *   npx tsx scripts/test-feature-modals.ts
 */

import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const FEATURES = [
  { id: 'digital-playbook', name: 'Digital Playbook' },
  { id: 'pro-analytics', name: 'Pro-Level Analytics' },
  { id: 'ai-film-tagging', name: 'AI Film Tagging' },
  { id: 'game-day-prep', name: 'Game-Day Preparation' },
];

const VIEWPORTS = [
  { name: 'Desktop', width: 1280, height: 720 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];

async function testFeatureCard(page: Page, featureIndex: number): Promise<TestResult> {
  const feature = FEATURES[featureIndex];
  const result: TestResult = {
    name: `Click ${feature.name} card`,
    passed: false,
    details: '',
  };

  try {
    // Find and click the feature card
    const cards = page.locator('#features button');
    const card = cards.nth(featureIndex);

    if (!(await card.isVisible())) {
      result.details = 'Card not visible';
      return result;
    }

    await card.click();
    await page.waitForTimeout(500);

    // Check if modal opened
    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible()) {
      result.passed = true;
      result.details = 'Modal opened successfully';
    } else {
      result.details = 'Modal did not open';
    }
  } catch (error) {
    result.details = `Error: ${error}`;
  }

  return result;
}

async function testVideoPlayback(page: Page): Promise<TestResult> {
  const result: TestResult = {
    name: 'Video playback',
    passed: false,
    details: '',
  };

  try {
    const video = page.locator('video');

    if (!(await video.isVisible({ timeout: 3000 }))) {
      result.details = 'Video element not visible';
      return result;
    }

    // Wait for video to load
    await page.waitForTimeout(2000);

    // Check if video has loaded
    const videoElement = await video.elementHandle();
    if (!videoElement) {
      result.details = 'Could not get video element handle';
      return result;
    }

    const readyState = await page.evaluate((el) => (el as HTMLVideoElement).readyState, videoElement);
    const paused = await page.evaluate((el) => (el as HTMLVideoElement).paused, videoElement);

    if (readyState >= 2) {
      result.passed = true;
      result.details = `Video loaded (readyState: ${readyState}, playing: ${!paused})`;
    } else {
      result.details = `Video not ready (readyState: ${readyState})`;
    }
  } catch (error) {
    result.details = `Error: ${error}`;
  }

  return result;
}

async function testModalClose(page: Page): Promise<TestResult> {
  const result: TestResult = {
    name: 'Modal close (ESC key)',
    passed: false,
    details: '',
  };

  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const modal = page.locator('[role="dialog"]');
    if (!(await modal.isVisible())) {
      result.passed = true;
      result.details = 'Modal closed successfully';
    } else {
      result.details = 'Modal did not close';
    }
  } catch (error) {
    result.details = `Error: ${error}`;
  }

  return result;
}

async function testPlayPauseButton(page: Page, isMobile: boolean): Promise<TestResult> {
  const result: TestResult = {
    name: `Play/Pause button ${isMobile ? '(mobile - always visible)' : '(desktop - hover)'}`,
    passed: false,
    details: '',
  };

  try {
    const button = page.locator('button[aria-label="Pause video"], button[aria-label="Play video"]');

    if (isMobile) {
      // On mobile, button should always be visible
      if (await button.isVisible()) {
        result.passed = true;
        result.details = 'Button visible on mobile';
      } else {
        result.details = 'Button not visible on mobile (should be always visible)';
      }
    } else {
      // On desktop, button should be hidden until hover
      const video = page.locator('video');
      await video.hover();
      await page.waitForTimeout(300);

      if (await button.isVisible()) {
        result.passed = true;
        result.details = 'Button visible on hover';
      } else {
        result.details = 'Button not visible on hover';
      }
    }
  } catch (error) {
    result.details = `Error: ${error}`;
  }

  return result;
}

async function runTests(browser: Browser, viewport: typeof VIEWPORTS[0]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const isMobile = viewport.width < 640;

  console.log(`\n📱 Testing on ${viewport.name} (${viewport.width}x${viewport.height})`);
  console.log('─'.repeat(50));

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();

  try {
    // Navigate to homepage
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Scroll to features section
    await page.locator('#features').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Test first feature card (Digital Playbook)
    const cardResult = await testFeatureCard(page, 0);
    results.push(cardResult);
    logResult(cardResult);

    if (cardResult.passed) {
      // Test video playback
      const videoResult = await testVideoPlayback(page);
      results.push(videoResult);
      logResult(videoResult);

      // Test play/pause button visibility
      const playPauseResult = await testPlayPauseButton(page, isMobile);
      results.push(playPauseResult);
      logResult(playPauseResult);

      // Test modal close
      const closeResult = await testModalClose(page);
      results.push(closeResult);
      logResult(closeResult);
    }

    // Test all feature cards open
    for (let i = 1; i < FEATURES.length; i++) {
      await page.locator('#features').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const result = await testFeatureCard(page, i);
      results.push(result);
      logResult(result);

      if (result.passed) {
        // Close modal for next test
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  } catch (error) {
    console.error(`Error during ${viewport.name} tests:`, error);
  } finally {
    await context.close();
  }

  return results;
}

function logResult(result: TestResult): void {
  const icon = result.passed ? '✅' : '❌';
  console.log(`  ${icon} ${result.name}: ${result.details}`);
}

async function main(): Promise<void> {
  console.log('🧪 Feature Demo Modal Tests');
  console.log('═'.repeat(50));

  const browser = await chromium.launch({ headless: true });
  const allResults: { viewport: string; results: TestResult[] }[] = [];

  try {
    for (const viewport of VIEWPORTS) {
      const results = await runTests(browser, viewport);
      allResults.push({ viewport: viewport.name, results });
    }

    // Summary
    console.log('\n═'.repeat(50));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(50));

    let totalPassed = 0;
    let totalTests = 0;

    for (const { viewport, results } of allResults) {
      const passed = results.filter((r) => r.passed).length;
      const total = results.length;
      totalPassed += passed;
      totalTests += total;

      const icon = passed === total ? '✅' : '⚠️';
      console.log(`${icon} ${viewport}: ${passed}/${total} tests passed`);
    }

    console.log('─'.repeat(50));
    const allPassed = totalPassed === totalTests;
    console.log(`${allPassed ? '🎉' : '⚠️'} Total: ${totalPassed}/${totalTests} tests passed`);

    if (!allPassed) {
      console.log('\n❌ Some tests failed. Check the output above for details.');
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main();
