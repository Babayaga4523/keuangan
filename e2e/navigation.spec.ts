import { test, expect } from '@playwright/test';

test.describe('Application Navigation & Routing', () => {
  test('redirects root / to /dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('can navigate across key pages via routes', async ({ page }) => {
    const routes = ['/tabungan', '/budget', '/parameter', '/laporan'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(route), { timeout: 20000 });
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('can navigate via sidebar links on desktop and direct routes on mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.goto('/tabungan');
      await page.waitForLoadState('domcontentloaded');
    } else {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      const tabunganLink = page.locator('aside a[href="/tabungan"]').first();
      await expect(tabunganLink).toBeVisible({ timeout: 20000 });
      await tabunganLink.click();
    }
    await expect(page).toHaveURL(/.*tabungan/, { timeout: 20000 });
  });
});
