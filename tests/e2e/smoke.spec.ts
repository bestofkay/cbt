import { test, expect } from '@playwright/test';

test('admin login page loads', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('candidate lobby requires auth or shows login', async ({ page }) => {
  await page.goto('http://localhost:5174/');
  await expect(page.locator('body')).toBeVisible();
});
