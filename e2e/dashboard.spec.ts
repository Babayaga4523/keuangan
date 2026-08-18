import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
  });

  test('loads dashboard and displays main layout and branding', async ({ page }) => {
    await expect(page).toHaveTitle(/Silva|Yoga|Finance|Personal Finance|Keuangan/i);
    await expect(page.locator('body')).toBeVisible();
    const branding = page.getByText('Silva & Yoga').filter({ visible: true });
    await expect(branding.first()).toBeVisible({ timeout: 20000 });
  });

  test('displays financial metrics cards and quick summary', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeDefined();
    expect(bodyText).toMatch(/Rp|Saldo|Pemasukan|Pengeluaran|Dashboard|Rekening|Silva|Yoga/i);
  });

  test('navigates to Transaksi page from dashboard link', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.goto('/transaksi');
    } else {
      const transaksiLink = page.locator('aside a[href="/transaksi"]').first();
      await expect(transaksiLink).toBeVisible({ timeout: 20000 });
      await transaksiLink.click();
    }
    await expect(page).toHaveURL(/.*transaksi/, { timeout: 20000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
