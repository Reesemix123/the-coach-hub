import { Page, expect } from '@playwright/test';

/**
 * Test Helpers for Youth Coach Hub E2E Tests
 *
 * Common utilities for navigation, assertions, and data access.
 */

// Environment configuration
export const TEST_CONFIG = {
  ownerEmail: process.env.TEST_OWNER_EMAIL || '',
  ownerPassword: process.env.TEST_OWNER_PASSWORD || '',
  coachEmail: process.env.TEST_COACH_EMAIL || '',
  coachPassword: process.env.TEST_COACH_PASSWORD || '',
  teamId: process.env.TEST_TEAM_ID || '',
  gameId: process.env.TEST_GAME_ID || '',
};

/**
 * Navigate to a team-specific page
 */
export async function navigateToTeamPage(
  page: Page,
  teamId: string,
  section:
    | 'dashboard'
    | 'roster'
    | 'playbook'
    | 'film'
    | 'schedule'
    | 'practice'
    | 'analytics-reporting'
    | 'game-week'
    | 'strategy-assistant'
    | 'settings'
): Promise<void> {
  const sectionPath = section === 'dashboard' ? '' : `/${section}`;
  await page.goto(`/teams/${teamId}${sectionPath}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Get the first team ID - works whether on teams list or team dashboard
 */
export async function getFirstTeamId(page: Page): Promise<string | null> {
  // First check if we're already on a team page
  const currentUrl = page.url();
  const currentMatch = currentUrl.match(/\/teams\/([a-f0-9-]+)/);
  if (currentMatch) {
    return currentMatch[1];
  }

  // Navigate to teams list
  await page.goto('/teams');
  await page.waitForLoadState('domcontentloaded');

  // Check if we were redirected to a team dashboard
  const newUrl = page.url();
  const redirectMatch = newUrl.match(/\/teams\/([a-f0-9-]+)/);
  if (redirectMatch) {
    return redirectMatch[1];
  }

  // Look for team links on the teams list page
  const teamLink = page.locator('a[href*="/teams/"]').first();
  const href = await teamLink.getAttribute('href').catch(() => null);

  if (href) {
    const match = href.match(/\/teams\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  return null;
}

/**
 * Wait for page content to fully load (no more loading indicators)
 */
export async function waitForContentLoad(page: Page): Promise<void> {
  // Wait for any "Loading..." text to disappear
  const loadingIndicator = page.locator('text=/Loading\\.\\.\\.?/i');
  const spinners = page.locator('[class*="animate-spin"]');

  // Wait up to 10 seconds for loading to complete
  try {
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
  } catch {
    // Ignore if no loading indicator found
  }

  try {
    await spinners.first().waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    // Ignore if no spinners found
  }

  await page.waitForLoadState('networkidle');
}

/**
 * Fill a form field by label text
 */
export async function fillFieldByLabel(
  page: Page,
  labelText: string,
  value: string
): Promise<void> {
  const label = page.locator(`text=${labelText}`);
  const input = label.locator('..').locator('input, textarea, select').first();
  await input.fill(value);
}

/**
 * Click a button by its text content
 */
export async function clickButton(page: Page, buttonText: string): Promise<void> {
  await page.click(`button:has-text("${buttonText}")`);
}

/**
 * Check if an element with specific text is visible
 */
export async function isTextVisible(page: Page, text: string): Promise<boolean> {
  const element = page.locator(`text=${text}`);
  return element.isVisible();
}

/**
 * Wait for a toast/notification message
 */
export async function waitForToast(page: Page, message: string): Promise<void> {
  await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 5000 });
}

/**
 * Select an option from a dropdown by its visible text
 */
export async function selectDropdownOption(
  page: Page,
  selectSelector: string,
  optionText: string
): Promise<void> {
  const select = page.locator(selectSelector);
  await select.selectOption({ label: optionText });
}

/**
 * Check a checkbox or toggle
 */
export async function checkCheckbox(
  page: Page,
  selector: string,
  checked: boolean = true
): Promise<void> {
  const checkbox = page.locator(selector);
  const isChecked = await checkbox.isChecked();

  if (isChecked !== checked) {
    await checkbox.click();
  }
}

/**
 * Get the value of an input field
 */
export async function getInputValue(page: Page, selector: string): Promise<string> {
  return page.locator(selector).inputValue();
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

/**
 * Assert that a specific number of elements exist
 */
export async function assertElementCount(
  page: Page,
  selector: string,
  expectedCount: number
): Promise<void> {
  const count = await page.locator(selector).count();
  expect(count).toBe(expectedCount);
}

/**
 * Get all text content from elements matching a selector
 */
export async function getAllTextContent(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).allTextContents();
}

/**
 * Wait for navigation to a URL pattern
 */
export async function waitForNavigation(page: Page, urlPattern: RegExp): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: 10000 });
}

/**
 * Scroll to an element
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Assert page title contains text
 */
export async function assertPageTitleContains(page: Page, text: string): Promise<void> {
  await expect(page).toHaveTitle(new RegExp(text, 'i'));
}

/**
 * Clear and fill an input field
 */
export async function clearAndFill(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const input = page.locator(selector);
  await input.clear();
  await input.fill(value);
}

/**
 * Wait for element to be enabled
 */
export async function waitForEnabled(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toBeEnabled({ timeout: 5000 });
}

/**
 * Check if we're on a specific page by URL pattern
 */
export function isOnPage(page: Page, urlPattern: RegExp): boolean {
  return urlPattern.test(page.url());
}

/**
 * Get table data as an array of objects
 */
export async function getTableData(
  page: Page,
  tableSelector: string
): Promise<Record<string, string>[]> {
  const table = page.locator(tableSelector);
  const headers = await table.locator('thead th').allTextContents();
  const rows = await table.locator('tbody tr').all();

  const data: Record<string, string>[] = [];

  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    const rowData: Record<string, string> = {};

    headers.forEach((header, index) => {
      rowData[header.trim()] = cells[index]?.trim() || '';
    });

    data.push(rowData);
  }

  return data;
}

/**
 * Confirm a browser dialog (alert, confirm, prompt)
 */
export async function handleDialog(
  page: Page,
  action: 'accept' | 'dismiss',
  promptText?: string
): Promise<void> {
  page.once('dialog', async (dialog) => {
    if (action === 'accept') {
      await dialog.accept(promptText);
    } else {
      await dialog.dismiss();
    }
  });
}

/**
 * Wait for a specific network request to complete
 */
export async function waitForApiRequest(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForResponse(
    (response) =>
      (typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url())) && response.status() === 200
  );
}
