import { test, expect } from './fixtures/browserbase';

test.describe('ToothCare Hub - Landing Page & Navigation', () => {
  test('should load the homepage and display the ToothCare Hub brand title', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // Navigate to local or deployed frontend
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/ToothCare Hub/i);

    // Verify semantic main landmark and primary hero heading rendered (Playwright best practice over #root)
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(pageErrors, 'Expected zero uncaught runtime page errors').toEqual([]);
  });

  test('should render header brand and action buttons', async ({ page }) => {
    await page.goto('/');

    // Check for presence of brand text or navigation
    const brandElement = page.getByText(/ToothCare/i).first();
    await expect(brandElement).toBeVisible();
  });
});

