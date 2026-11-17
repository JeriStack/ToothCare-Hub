/**
 * Manual interaction check for the responsive shell (local tool, needs the dev stack running).
 * Verifies drawer open/close (button, Escape, backdrop, route change), scroll lock, focus return,
 * theme toggle reachability + persistence across reload, and light-by-default.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Password123!';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`); };

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: BASE, viewport: { width: 375, height: 812 }, hasTouch: true });
const api = context.request;
const csrf = (await (await api.get('/api/v1/auth/csrf-token')).json()).data.csrf_token;
await api.post('/api/v1/auth/login', { data: { email: 'admin@toothcare.com', password: PASSWORD, remember_me: false }, headers: { 'X-CSRF-Token': csrf } });

const page = await context.newPage();
await page.goto('/admin', { waitUntil: 'networkidle' });

check('Light mode is default with no saved preference', !(await page.evaluate(() => document.documentElement.classList.contains('dark'))));

const menuBtn = page.getByRole('button', { name: 'Navigation menu' });
const drawer = page.locator('#portal-sidebar');
check('Sidebar hidden on mobile before opening', !(await drawer.isVisible()));

await menuBtn.click();
await page.waitForTimeout(350);
check('Drawer opens from hamburger', await drawer.isVisible());
check('Body scroll locked while open', (await page.evaluate(() => document.body.style.overflow)) === 'hidden');
const focusInDrawer = await page.evaluate(() => !!document.querySelector('#portal-sidebar')?.contains(document.activeElement));
check('Focus moved into drawer', focusInDrawer);

await page.keyboard.press('Escape');
await page.waitForTimeout(350);
check('Escape closes drawer', !(await drawer.isVisible()));
check('Body scroll restored after close', (await page.evaluate(() => document.body.style.overflow)) !== 'hidden');
check('Focus returns to hamburger trigger', await menuBtn.evaluate((el) => el === document.activeElement));

await menuBtn.click();
await page.waitForTimeout(350);
await page.mouse.click(370, 400); // right edge = backdrop (drawer is on the left)
await page.waitForTimeout(350);
check('Backdrop click closes drawer', !(await drawer.isVisible()));

await menuBtn.click();
await page.waitForTimeout(350);
const target = drawer.getByRole('button', { name: /Patient Registry/ }).first();
const hasTarget = await target.count();
if (hasTarget) {
  await target.click();
  await page.waitForTimeout(500);
  check('Navigating closes drawer', !(await drawer.isVisible()));
  check('Route updated to /admin/patients', page.url().endsWith('/admin/patients'));
} else {
  check('Drawer contains Patient Registry item', false);
}

const toggle = page.getByTestId('theme-toggle').first();
check('Theme toggle visible in mobile header', await toggle.isVisible());
const box = await toggle.boundingBox();
check('Theme toggle tap target >= 24px', !!box && box.width >= 24 && box.height >= 24, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no box');
await toggle.click();
check('Toggle switches to dark', await page.evaluate(() => document.documentElement.classList.contains('dark')));
await page.reload({ waitUntil: 'networkidle' });
check('Dark preference persists after reload', await page.evaluate(() => document.documentElement.classList.contains('dark')));
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(300);
check('Desktop: sidebar visible persistent', await drawer.isVisible());
check('Theme unchanged after resize', await page.evaluate(() => document.documentElement.classList.contains('dark')));
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(300);
check('Tablet 768: hamburger or sidebar available', (await menuBtn.isVisible()) || (await drawer.isVisible()));
check('No horizontal overflow at tablet', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
