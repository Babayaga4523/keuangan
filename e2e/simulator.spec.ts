import { test, expect } from '@playwright/test';

test.describe('Simulator Roadmap Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/simulator');
  });

  test('loads simulator page and displays simulation parameters', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const content = await page.textContent('body');
    expect(content).toMatch(/Simulator|Roadmap|Proyeksi|Parameter/i);
  });
});
