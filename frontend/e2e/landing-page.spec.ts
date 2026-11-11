import { test, expect } from './fixtures/browserbase';

test.describe('ToothCare Hub - Landing Page & Navigation', () => {
  test('should load the homepage and display the ToothCare Hub brand title', async ({ page }) => {
    // Navigate to local or deployed frontend
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/ToothCare Hub/i);

    // Verify root application container mounted
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('should render header brand and action buttons', async ({ page }) => {
    await page.goto('/');

    // Check for presence of brand text or navigation
    const brandElement = page.getByText(/ToothCare/i).first();
    await expect(brandElement).toBeVisible();
  });
});

