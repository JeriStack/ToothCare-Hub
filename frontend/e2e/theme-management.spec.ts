import { test, expect } from './fixtures/browserbase';

const TARGET_VIEWPORTS = [
  { name: 'small-mobile-320', width: 320, height: 640 },
  { name: 'standard-mobile-375', width: 375, height: 667 },
  { name: 'large-mobile-390', width: 390, height: 844 },
  { name: 'large-mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'large-tablet-1024', width: 1024, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'large-desktop-1920', width: 1920, height: 1080 },
];

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password'];

test.describe('ToothCare Hub - System-Wide Light/Dark Theme E2E Verification', () => {
  test('defaults strictly to Light Mode, toggles to Dark Mode, persists across reload, and switches back cleanly', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const root = page.locator('html');
    await expect(root).not.toHaveClass(/dark/);
    await expect(root).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');

    const toggle = page.getByTestId('theme-toggle').first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 247, 250)');

    await toggle.click();

    await expect(root).toHaveClass(/dark/);
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 24, 39)');

    const storedTheme = await page.evaluate(() => window.localStorage.getItem('toothcare_theme'));
    expect(storedTheme).toBe('dark');

    await page.reload();
    await expect(root).toHaveClass(/dark/);
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('theme-toggle').first()).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('theme-toggle').first().click();
    await expect(root).not.toHaveClass(/dark/);
    await expect(root).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(244, 247, 250)');
    const revertedTheme = await page.evaluate(() => window.localStorage.getItem('toothcare_theme'));
    expect(revertedTheme).toBe('light');
  });

  for (const route of PUBLIC_ROUTES) {
    test(`maintains zero horizontal overflow in Light and Dark modes across all 9 viewports on ${route}`, async ({
      page,
    }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#root')).toBeVisible();

      for (const themeMode of ['light', 'dark'] as const) {
        const toggle = page.getByTestId('theme-toggle').first();
        await expect(toggle).toBeVisible();

        const currentlyDark = await page.evaluate(() =>
          document.documentElement.classList.contains('dark')
        );
        if ((themeMode === 'dark') !== currentlyDark) {
          await toggle.click();
        }

        await expect(page.locator('html')).toHaveAttribute('data-theme', themeMode);
        await expect(page.locator('body')).toHaveCSS(
          'background-color',
          themeMode === 'dark' ? 'rgb(17, 24, 39)' : 'rgb(244, 247, 250)'
        );

        for (const vp of TARGET_VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const metrics = await page.evaluate(() => ({
            theme: document.documentElement.dataset.theme,
            hasDarkClass: document.documentElement.classList.contains('dark'),
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));

          expect(metrics.theme, `${route} @ ${vp.name} (${themeMode})`).toBe(themeMode);
          expect(metrics.hasDarkClass, `${route} @ ${vp.name} (${themeMode})`).toBe(
            themeMode === 'dark'
          );
          expect(
            metrics.scrollWidth,
            `Horizontal overflow on ${route} @ ${vp.name} (${themeMode}): ${metrics.scrollWidth} > ${metrics.innerWidth}`
          ).toBeLessThanOrEqual(metrics.innerWidth);
        }
      }
    });
  }
});
