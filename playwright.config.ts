import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Also try loading from .env.test if it exists
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

/**
 * Playwright configuration for Youth Coach Hub
 * Comprehensive E2E testing based on User Guide documentation
 */
export default defineConfig({
  testDir: './tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallel workers to reduce dev server load */
  workers: process.env.CI ? 1 : 2,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  /* Global timeout for each test */
  timeout: 60000,

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project - authenticates and saves state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Main tests as owner
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/owner.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.(coach|mobile)\.spec\.ts/, /marker-test\.spec\.ts/],
    },
    // Tests as coach (limited permissions)
    {
      name: 'chromium-coach',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/coach.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.coach\.spec\.ts/,
    },
    // Mobile viewport tests
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/.auth/owner.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
