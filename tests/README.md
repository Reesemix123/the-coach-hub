# Automated Testing Guide - Playwright

## Overview

Comprehensive end-to-end tests for Youth Coach Hub using Playwright. Tests cover all major features including team management, playbook, film analysis, practice planning, and more.

## Setup

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Configure Test Credentials

Add these variables to your `.env.local`:

```bash
# Required: Owner account credentials
TEST_OWNER_EMAIL=your-email@example.com
TEST_OWNER_PASSWORD=your-password

# Optional: Coach account for role-based testing
TEST_COACH_EMAIL=
TEST_COACH_PASSWORD=

# Optional: Specific IDs (auto-detected if not provided)
TEST_TEAM_ID=
TEST_GAME_ID=

# Optional: Service role key for test data seeding
TEST_SUPABASE_SERVICE_KEY=your-service-role-key
```

### 3. Test Data Requirements

For comprehensive testing, your test account should have:
- ✅ At least one team
- ✅ Several players on the roster
- ✅ Some playbook plays (offense, defense, special teams)
- ✅ At least one game with film
- ✅ Some tagged plays (for analytics)
- ✅ Practice plans and templates
- ✅ Schedule events

---

## Running Tests

### Run All Tests (Headless)
```bash
npm run test:e2e
```

### Run Tests with UI (Recommended for Development)
```bash
npm run test:e2e:ui
```
- Opens interactive Playwright UI
- See tests running in real-time
- Debug failures easily
- View screenshots and videos

### Run Tests with Browser Visible
```bash
npm run test:e2e:headed
```
- Watch tests run in actual browser
- Good for understanding what's happening

### Debug a Specific Test
```bash
npm run test:e2e:debug
```
- Opens Playwright Inspector
- Step through tests line by line
- Set breakpoints

### View Test Report (After Running)
```bash
npm run test:report
```
- Shows HTML report with screenshots
- Displays failures and traces

---

## Test Structure

### What's Tested

**1. Game Week Integration**
- ✅ Strategy Station card appears
- ✅ Metrics display correctly
- ✅ Navigation links work

**2. Strategy Report Generation**
- ✅ Game selector works
- ✅ Report generates successfully
- ✅ All sections render
- ✅ Data quality badges show
- ✅ Insights have priorities
- ✅ Opponent tendencies table displays
- ✅ Team analysis shows

**3. Strategic Questions**
- ✅ Navigation works
- ✅ Questions grouped by category
- ✅ Responses save correctly
- ✅ Progress bar updates
- ✅ Data persists after refresh

**4. Preparation Checklist**
- ✅ Navigation works
- ✅ Priority cards display
- ✅ Items check off
- ✅ Progress updates
- ✅ Notes save correctly

**5. Responsive Design**
- ✅ Works on mobile (375px)
- ✅ Works on tablet (768px)
- ✅ Works on desktop

**6. Performance**
- ✅ Page loads in < 10 seconds
- ✅ No excessive database queries

---

## Understanding Test Results

### ✅ Passing Tests
All tests passed! Features work as expected.

### ❌ Failing Tests
Check the error message and:
1. Look at screenshot (saved in `test-results/`)
2. Watch video recording (if available)
3. Check console logs in report
4. Common issues:
   - Missing data (no games/plays)
   - RLS permissions
   - Timing issues (increase timeout)
   - UI changes (update selectors)

### ⊘ Skipped Tests
Some tests skip if prerequisites aren't met:
- No upcoming games
- No game ID available
- Missing test data

This is normal! Tests adapt to your data.

---

## Test Configuration

Edit `playwright.config.ts` to customize:

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,  // 30 sec per test
  retries: 2,      // Retry failed tests
  workers: 4,      // Run tests in parallel

  use: {
    baseURL: 'http://localhost:3002',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

---

## Writing New Tests

### Example: Test a new feature

```typescript
test('should do something cool', async ({ page }) => {
  // Navigate
  await page.goto('/your-page');

  // Interact
  await page.click('button:has-text("Click Me")');

  // Assert
  await expect(page.locator('text=Success')).toBeVisible();
});
```

### Common Patterns

**Wait for element:**
```typescript
await page.waitForSelector('text=Loading...', { timeout: 5000 });
```

**Fill form:**
```typescript
await page.fill('input[name="email"]', 'test@example.com');
await page.click('button[type="submit"]');
```

**Check visibility:**
```typescript
await expect(page.locator('text=Success')).toBeVisible();
```

**Get text content:**
```typescript
const text = await page.locator('.status').textContent();
expect(text).toBe('Active');
```

**Take screenshot:**
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

---

## Debugging Tips

### 1. Use UI Mode
```bash
npm run test:e2e:ui
```
- Best debugging experience
- See every step
- Time travel through test execution

### 2. Add Console Logs
```typescript
console.log('Current URL:', page.url());
const text = await page.locator('.status').textContent();
console.log('Status:', text);
```

### 3. Pause Test
```typescript
await page.pause(); // Opens inspector
```

### 4. Slow Down Test
```typescript
test.use({ launchOptions: { slowMo: 500 } }); // 500ms between actions
```

### 5. Run Single Test
```bash
npx playwright test strategy-assistant.spec.ts:42  # Run line 42
```

### 6. View Trace
```bash
npx playwright show-trace test-results/trace.zip
```

---

## Continuous Integration (CI)

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run tests
        run: npm run test:e2e
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Best Practices

### ✅ DO:
- Use dedicated test account
- Create realistic test data
- Test user workflows (not implementation)
- Keep tests independent (can run in any order)
- Use meaningful test names
- Add comments for complex logic
- Clean up test data after runs (if needed)

### ❌ DON'T:
- Don't use production accounts
- Don't rely on exact timing (use waitForSelector)
- Don't hardcode IDs (auto-detect when possible)
- Don't test implementation details
- Don't skip test cleanup
- Don't commit `.env.test` (use `.env.test.example`)

---

## Troubleshooting

### "Browser not found"
```bash
npx playwright install chromium
```

### "Port 3002 in use"
Kill other dev servers or change port in `playwright.config.ts`

### "Authentication failed"
Check `.env.test` credentials are correct

### "Element not found"
- Increase timeout
- Check selector (use Playwright Inspector)
- Ensure page loaded completely

### "Test is flaky"
- Add explicit waits
- Wait for network idle
- Increase timeout for slow operations

### "Database permission denied"
- Check RLS policies in Supabase
- Verify test user is on the team

---

## Helpful Resources

- [Playwright Docs](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [Test Selectors](https://playwright.dev/docs/selectors)

---

## Next Steps

After tests pass:
1. ✅ Run tests locally
2. ✅ Set up CI/CD (GitHub Actions)
3. ✅ Add tests for new features
4. ✅ Monitor test coverage
5. ✅ Keep tests up to date with UI changes

Happy testing! 🎯
