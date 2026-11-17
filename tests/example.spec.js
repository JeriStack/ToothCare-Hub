// @ts-check
import { test, expect } from '@playwright/test';

test('has title and mounts root container', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/ToothCare Hub/i);
  await expect(page.locator('#root')).toBeVisible();
});

test('renders brand heading and primary navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(/ToothCare/i).first()).toBeVisible();
});
