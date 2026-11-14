/**
 * Treatment-record form probe (local tool; needs the dev stack + seeded demo dentist).
 *
 * For several viewports and both themes: opens an appointment as the dentist, opens the
 * treatment-record editor, and checks layout, labelled fields, odontogram behaviour, validation
 * feedback visibility, and that a valid submit sends the expected payload.
 * SAFETY: every non-GET /api/ request is intercepted; treatment-record writes are captured and
 * answered with a fake record. Nothing is written to the database.
 *
 * Usage: node e2e/treatment-form-check.mjs [--shots]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Password123!';
const SHOTS = process.argv.includes('--shots');
const outDir = path.resolve('test-results', 'treatment-form');
fs.mkdirSync(outDir, { recursive: true });

const RUNS = [
  { w: 320, h: 568, theme: 'light' },
  { w: 375, h: 667, theme: 'dark' },
  { w: 430, h: 932, theme: 'light' },
  { w: 768, h: 1024, theme: 'dark' },
  { w: 844, h: 390, theme: 'light', label: 'landscape' },
  { w: 1280, h: 800, theme: 'light' },
];

const results = [];
const check = (run, name, ok, detail = '') => {
  results.push({ run, name, ok, detail });
  if (!ok) console.log(`FAIL  [${run}] ${name}${detail ? ' :: ' + detail : ''}`);
};

const inViewport = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= -1 && r.right <= document.documentElement.clientWidth + 1;
});

const browser = await chromium.launch();
for (const cfg of RUNS) {
  const run = `${cfg.w}x${cfg.h} ${cfg.theme}${cfg.label ? ' ' + cfg.label : ''}`;
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: cfg.w, height: cfg.h }, hasTouch: cfg.w < 1024, isMobile: cfg.w < 768, timezoneId: 'Asia/Manila' });
  await context.addInitScript((t) => { try { localStorage.setItem('toothcare_theme', t); } catch { /* noop */ } }, cfg.theme);
  const csrf = (await (await context.request.get('/api/v1/auth/csrf-token')).json()).data.csrf_token;
  await context.request.post('/api/v1/auth/login', { data: { email: 'dentist@toothcare.com', password: PASSWORD, remember_me: false }, headers: { 'X-CSRF-Token': csrf } });

  const captured = [];
  await context.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.continue();
    const url = new URL(req.url()).pathname;
    if (/\/treatment-records$/.test(url) && req.method() === 'POST') {
      const body = req.postDataJSON();
      captured.push(body);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 99999, is_locked: 0, locked_at: '2099-01-01 00:00:00', created_at: '2026-11-14 09:00:00', ...body } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 150)));

  // Open the CONFIRMED appointment (no record yet) from the dentist's list
  await page.goto('/dentist/appointments', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const openers = page.locator('main').getByRole('button').filter({ hasText: /view|detail|open|manage|chart|record/i });
  let opened = false;
  const n = await openers.count();
  for (let i = 0; i < n && !opened; i++) {
    await openers.nth(i).scrollIntoViewIfNeeded().catch(() => {});
    await openers.nth(i).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (await page.getByRole('button', { name: /Document Treatment Record/i }).count()) opened = true;
    else await page.goto('/dentist/appointments', { waitUntil: 'networkidle' });
  }
  check(run, 'Reached an appointment that allows documenting a record', opened);
  if (!opened) { await context.close(); continue; }

  await page.getByRole('button', { name: /Document Treatment Record/i }).first().click();
  const form = page.locator('form').filter({ has: page.locator('#tr-diagnosis') });
  await form.waitFor();
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const f = document.querySelector('form:has(#tr-diagnosis)');
    const chart = f.querySelector('[aria-label="FDI Dental Arch Chart"]');
    const teeth = [...chart.querySelectorAll('button[aria-pressed]')];
    const tb = teeth.map((b) => b.getBoundingClientRect());
    const fields = [...f.querySelectorAll('textarea')];
    const actions = [...f.querySelectorAll('button')].filter((b) => !chart.contains(b));
    return {
      overflow: document.documentElement.scrollWidth > vw + 1,
      sw: document.documentElement.scrollWidth, vw,
      teethCount: teeth.length,
      teethMinW: Math.round(Math.min(...tb.map((r) => r.width))),
      teethMinH: Math.round(Math.min(...tb.map((r) => r.height))),
      teethOutside: tb.filter((r) => r.left < -1 || r.right > vw + 1).length,
      fieldCount: fields.length,
      unlabelled: fields.filter((t) => !(t.labels && t.labels.length)).length,
      smallFont: fields.filter((t) => parseFloat(getComputedStyle(t).fontSize) < 16).length,
      fieldsOutside: fields.filter((t) => { const r = t.getBoundingClientRect(); return r.left < -1 || r.right > vw + 1; }).length,
      actionRects: actions.map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; }),
      labelRowOverflow: [...f.querySelectorAll('label')].filter((l) => l.parentElement.scrollWidth > l.parentElement.clientWidth + 1).length,
    };
  });
  check(run, 'Editor: no page overflow', !m.overflow, `${m.sw}/${m.vw}`);
  check(run, 'Odontogram: all 32 teeth rendered', m.teethCount === 32, String(m.teethCount));
  check(run, 'Odontogram: teeth inside viewport', m.teethOutside === 0, String(m.teethOutside));
  check(run, 'Odontogram: tooth buttons >= 36px tall and >= 24px wide', m.teethMinH >= 36 && m.teethMinW >= 24, `${m.teethMinW}x${m.teethMinH}`);
  check(run, 'Fields: every textarea has a label', m.unlabelled === 0, String(m.unlabelled));
  check(run, 'Fields: inside viewport', m.fieldsOutside === 0);
  if (cfg.w < 640) check(run, 'Fields: >= 16px font on phones', m.smallFont === 0, String(m.smallFont));
  check(run, 'Label rows do not overflow (label + counter)', m.labelRowOverflow === 0, String(m.labelRowOverflow));
  const badActions = m.actionRects.filter((a) => a.h < 36 || a.right > m.vw + 1);
  check(run, 'Action buttons >= 36px tall and inside viewport', badActions.length === 0, badActions.map((a) => `${a.t} ${a.w}x${a.h}`).join(' | '));
  if (SHOTS) await page.screenshot({ path: path.join(outDir, `${cfg.w}x${cfg.h}-${cfg.theme}-editor.png`), fullPage: true });

  // Odontogram behaviour
  const chart = page.locator('[aria-label="FDI Dental Arch Chart"]');
  const t18 = chart.locator('button[aria-pressed]').filter({ hasText: /^18$/ }).first();
  await t18.click();
  check(run, 'Tooth toggles on (aria-pressed)', (await t18.getAttribute('aria-pressed')) === 'true');
  check(run, 'Selected-teeth badge appears', (await chart.getByText('#18').count()) > 0);
  await chart.getByRole('button', { name: /\+ Upper Arch/ }).click();
  check(run, 'Upper arch selects 16 teeth', (await chart.locator('button[aria-pressed="true"]').count()) === 16);
  const rm = chart.getByRole('button', { name: 'Remove tooth 18' });
  const rb = await rm.boundingBox();
  check(run, 'Badge remove button >= 24px', !!rb && rb.width >= 24 && rb.height >= 24, rb ? `${Math.round(rb.width)}x${Math.round(rb.height)}` : 'none');
  await rm.click();
  check(run, 'Badge remove deselects the tooth', (await t18.getAttribute('aria-pressed')) === 'false');
  await chart.getByRole('button', { name: 'Clear' }).click();
  check(run, 'Clear deselects everything', (await chart.locator('button[aria-pressed="true"]').count()) === 0);

  // Validation feedback must be visible to a user who just tapped Save at the bottom
  const save = page.getByRole('button', { name: /Save Treatment Record/ });
  await save.scrollIntoViewIfNeeded();
  await save.click();
  await page.waitForTimeout(500);
  const alert = form.getByRole('alert').first();
  check(run, 'Validation error alert exists', (await alert.count()) > 0);
  if (await alert.count()) check(run, 'Validation error is on-screen after tapping Save (no manual scrolling)', await inViewport(alert));
  check(run, 'Focus moved to the first invalid field or the alert', await page.evaluate(() => { const a = document.activeElement; return !!a && (a.id === 'tr-diagnosis' || a.getAttribute('role') === 'alert'); }));

  // Long unbroken text must not break the layout
  const longWord = 'Periodontitis'.repeat(40);
  await page.locator('#tr-diagnosis').fill(longWord);
  await page.locator('#tr-procedure').fill('Ultrasonic scaling and root planing. ' + longWord);
  await page.locator('#tr-prescription').fill('Chlorhexidine 0.12% rinse');
  await page.locator('#tr-homecare').fill('Soft brush; avoid hot food for 24h.');
  await chart.locator('button[aria-pressed]').filter({ hasText: /^46$/ }).first().click();
  check(run, 'Long unbroken text: no page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  await save.scrollIntoViewIfNeeded();
  await save.click();
  // The first write on a fresh page also fetches a CSRF token, so wait for the request, not a fixed delay
  await page.waitForFunction(() => true);
  for (let i = 0; i < 50 && captured.length === 0; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(700);
  check(run, 'Valid submit sent exactly one create request', captured.length === 1, String(captured.length));
  if (captured[0]) {
    const b = captured[0];
    check(run, 'Payload has appointment_id, diagnosis, procedure_notes and teeth_treated=[46]', Number.isInteger(b.appointment_id) && b.diagnosis?.length > 100 && b.procedure_notes?.length > 100 && JSON.stringify(b.teeth_treated) === '[46]', JSON.stringify(b).slice(0, 120));
  }
  check(run, 'Viewer after save: no page overflow with long text', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  if (SHOTS) await page.screenshot({ path: path.join(outDir, `${cfg.w}x${cfg.h}-${cfg.theme}-saved.png`), fullPage: true });

  const realErrors = errors.filter((e) => !/status of 40[19]/.test(e));
  check(run, 'No console errors', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
  await context.close();
}
await browser.close();

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} treatment-form checks passed`);
process.exit(failed.length ? 1 : 0);
