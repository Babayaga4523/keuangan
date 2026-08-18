import { test, expect } from '@playwright/test';

test.describe('Transaksi Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/transaksi');
  });

  test('loads transaksi page properly', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const content = await page.textContent('body');
    expect(content).toMatch(/Transaksi|Pemasukan|Pengeluaran|Riwayat/i);
  });

  test('displays transaction filters or action buttons', async ({ page }) => {
    // Check for buttons or inputs on the transaction page
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });
});
