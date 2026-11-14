/**
 * Mobile booking-flow walkthrough (local tool; needs the dev stack + seeded demo patient).
 *
 * Walks Service -> Dentist -> Date/Slot -> Review -> Submit at several viewports and both themes.
 * SAFETY: every non-GET request to /api/ from the page is intercepted. The booking POST is answered
 * with a fake 201 (or a fake 409 for the conflict scenario); nothing is written to the database.
 *
 * Usage: node e2e/booking-flow-check.mjs [--shots]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Password123!';
const SHOTS = process.argv.includes('--shots');
const outDir = path.resolve('test-results', 'booking-flow');
fs.mkdirSync(outDir, { recursive: true });

const RUNS = [
  { w: 320, h: 568, theme: 'light' },
  { w: 375, h: 667, theme: 'dark' },
  { w: 430, h: 932, theme: 'light' },
  { w: 768, h: 1024, theme: 'dark' },
  { w: 844, h: 390, theme: 'light', label: 'landscape' },
  { w: 1280, h: 800, theme: 'light' },
  // Patient browsing from outside the clinic's zone: displayed times must stay in clinic time (Asia/Manila)
  { w: 390, h: 844, theme: 'light', label: 'tz-LA', timezoneId: 'America/Los_Angeles' },
];

const results = [];
const check = (run, name, ok, detail = '') => {
  results.push({ run, name, ok, detail });
  if (!ok) console.log(`FAIL  [${run}] ${name}${detail ? ' :: ' + detail : ''}`);
};

function layout() {
  const vw = document.documentElement.clientWidth;
  const small = [];
  for (const el of document.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.closest('header') || el.closest('.sr-only') || el.classList.contains('sr-only')) continue; // header audited separately; skip link is visually hidden
    if (r.width < 24 || r.height < 24) small.push(`${el.tagName.toLowerCase()}#${el.id || ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const smallFont = [];
  for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select')) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (el.getBoundingClientRect().width && fs < 16) smallFont.push(`${el.tagName.toLowerCase()}#${el.id || ''} ${fs}px`);
  }
  return { overflow: document.documentElement.scrollWidth > vw + 1, sw: document.documentElement.scrollWidth, vw, small, smallFont };
}

const browser = await chromium.launch();
for (const runCfg of RUNS) {
  const run = `${runCfg.w}x${runCfg.h} ${runCfg.theme}${runCfg.label ? ' ' + runCfg.label : ''}`;
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: runCfg.w, height: runCfg.h }, hasTouch: runCfg.w < 1024, isMobile: runCfg.w < 768, timezoneId: runCfg.timezoneId || 'Asia/Manila' });
  await context.addInitScript((t) => { try { localStorage.setItem('toothcare_theme', t); } catch { /* noop */ } }, runCfg.theme);
  const csrf = (await (await context.request.get('/api/v1/auth/csrf-token')).json()).data.csrf_token;
  const login = await context.request.post('/api/v1/auth/login', { data: { email: 'patient@toothcare.com', password: PASSWORD, remember_me: false }, headers: { 'X-CSRF-Token': csrf } });
  if (!login.ok()) throw new Error('patient login failed');

  let bookResponse = 'ok';
  const blockedWrites = [];
  await context.route('**/api/**', async (route) => {
    const req = route.request();
    if (process.env.DEBUG_ROUTES) console.log('route', req.method(), req.url());
    if (req.method() === 'GET') return route.continue();
    const url = new URL(req.url()).pathname;
    if (req.method() === 'POST' && /\/api\/v1\/appointments$/.test(url)) {
      const body = req.postDataJSON();
      if (bookResponse === 'conflict') {
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'SLOT_CONFLICT', message: 'This slot was just taken. Please choose another time.' } }) });
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 999999, status: 'PENDING', ...body } }) });
    }
    blockedWrites.push(`${req.method()} ${url}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 150)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 150)));

  const snap = async (name) => {
    const m = await page.evaluate(layout);
    check(run, `${name}: no page overflow`, !m.overflow, `${m.sw}/${m.vw}`);
    check(run, `${name}: no targets < 24px`, m.small.length === 0, m.small.slice(0, 4).join(' | '));
    if (runCfg.w < 640) check(run, `${name}: form fields >= 16px font (no iOS zoom)`, m.smallFont.length === 0, m.smallFont.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(outDir, `${runCfg.w}x${runCfg.h}-${runCfg.theme}-${name}.png`), fullPage: true });
  };

  await page.goto('/patient/book', { waitUntil: 'networkidle' });

  // Step 1: service
  const serviceCards = page.locator('main button[aria-pressed]');
  await serviceCards.first().waitFor({ timeout: 15000 });
  await snap('1-service');
  const nextService = page.getByRole('button', { name: /Next: Choose Dentist/ });
  check(run, 'Step1 a service is preselected and Next enabled', (await page.locator('main button[aria-pressed="true"]').count()) === 1 && !(await nextService.isDisabled()));
  const secondCard = serviceCards.nth(1);
  await secondCard.click();
  check(run, 'Choosing another service moves selection (aria-pressed)', (await secondCard.getAttribute('aria-pressed')) === 'true' && (await serviceCards.first().getAttribute('aria-pressed')) === 'false', 'first=' + (await serviceCards.first().getAttribute('aria-pressed')) + ' second=' +(await secondCard.getAttribute('aria-pressed')));
  await nextService.scrollIntoViewIfNeeded();
  const nb = await nextService.boundingBox();
  check(run, 'Step1 Next reachable & full-width on phones', !!nb && (runCfg.w >= 640 || nb.width >= runCfg.w - 80), nb ? `${Math.round(nb.width)}px` : 'none');
  await nextService.click();

  // Each new step should start in view; otherwise phone users tap Next at the bottom and land mid-page.
  const headingInView = async (re) => (await page.waitForTimeout(700), page).getByRole('heading', { name: re }).first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= -1 && r.top < window.innerHeight; });

  // Step 2: dentist
  await page.getByRole('heading', { name: /Select a Dentist/ }).waitFor();
  check(run, 'Step 2 heading visible after Next (no stale scroll)', await headingInView(/Select a Dentist/));
  await snap('2-dentist');
  await page.locator('main button[aria-pressed]').first().click();
  await page.getByRole('button', { name: /Next: Select Date/ }).click();
  await page.getByRole('heading', { name: /Choose Appointment Date/ }).waitFor();
  check(run, 'Step 3 heading visible after Next', await headingInView(/Choose Appointment Date/));

  // Step 3: date + slot. Find the first date in the next 21 days with slots.
  const dateInput = page.locator('#booking-date');
  await dateInput.waitFor();
  let foundSlot = false;
  let chosenSlotLabel = '';
  let chosenDate = '';
  const minAttr = await dateInput.getAttribute('min');
  const clinicToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  check(run, 'Date picker min = today in clinic time (Asia/Manila)', minAttr === clinicToday, 'min=' + minAttr + ' clinicToday=' + clinicToday);
  const today = new Date();
  for (let d = 1; d <= 21 && !foundSlot; d++) {
    const dt = new Date(today.getTime() + d * 86400000);
    const iso = dt.toISOString().slice(0, 10);
    const current = await dateInput.inputValue();
    const availability = current === iso ? null : page.waitForResponse((r) => r.url().includes('availability') && r.url().includes('date=' + iso), { timeout: 15000 }).catch(() => null);
    await dateInput.fill(iso);
    await availability;
    await page.waitForTimeout(250); // let React commit the slot grid
    const slot = page.locator('main button[aria-pressed]').filter({ hasText: /\d{1,2}:\d{2}/ });
    if (await slot.count()) {
      foundSlot = true;
      await snap('3-slots');
      const box = await slot.first().boundingBox();
      check(run, 'Slot buttons >= 44px tall', !!box && box.height >= 44, box ? `${Math.round(box.height)}px` : '');
      chosenSlotLabel = ((await slot.first().locator('span').first().textContent()) || '').trim();
      chosenDate = iso;
      await slot.first().click();
      check(run, 'Slot selection reflected (aria-pressed)', (await slot.first().getAttribute('aria-pressed')) === 'true');
    }
  }
  check(run, 'Found a date with bookable slots within 21 days', foundSlot);
  if (!foundSlot) { await context.close(); continue; }
  await page.getByRole('button', { name: /Next: Review/ }).click();
  await page.getByRole('heading', { name: /Review Appointment Summary/ }).waitFor();
  check(run, 'Step 4 heading visible after Next', await headingInView(/Review Appointment Summary/));

  // Step 4: review
  const submit = page.getByRole('button', { name: /Confirm & Submit/ });
  await submit.waitFor();
  await snap('4-review');
  check(run, 'Submit disabled until policy agreed', await submit.isDisabled());
  const summaryText = await page.locator('form').first().innerText();
  check(run, 'Review shows the same start time as the chosen slot button', summaryText.includes(chosenSlotLabel), 'slot='+chosenSlotLabel);
  const expectedDay = new Date(chosenDate + 'T12:00:00+08:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  check(run, 'Review shows the chosen calendar date', summaryText.includes(expectedDay), 'expected '+expectedDay);
  const complaint = page.locator('textarea');
  check(run, 'Chief complaint textarea has an accessible label', !!(await complaint.evaluate((el) => el.labels?.length || el.getAttribute('aria-label'))));
  await complaint.fill('Sensitivity on lower left molar when drinking cold water. '.repeat(3));
  await page.locator('#policy-agree').check();
  check(run, 'Submit enabled after agreeing', !(await submit.isDisabled()));

  // Conflict path first (fake 409), then success (fake 201)
  bookResponse = 'conflict';
  await submit.click();
  await page.getByText(/No Longer Available/i).first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400); // allow any scroll-into-view to settle
  const conflictText = page.getByText(/No Longer Available/i);
  check(run, '409 conflict banner rendered', (await conflictText.count()) > 0);
  if (await conflictText.count()) {
    const inView = await conflictText.first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= document.documentElement.clientWidth + 1; });
    check(run, 'Conflict banner is on-screen right after submit (no manual scrolling)', inView);
  }
  await snap('4b-conflict');

  bookResponse = 'ok';
  // After a 409 the page may send the user back to slot selection; walk forward again if so.
  const reselect = page.getByRole('button', { name: /Select Another Time Slot/ });
  if (await reselect.count()) {
    await reselect.click();
    await page.waitForLoadState('networkidle');
  }
  if (!(await page.getByRole('button', { name: /Confirm & Submit/ }).isVisible().catch(() => false))) {
    const slot = page.locator('main button[aria-pressed]').filter({ hasText: /\d{1,2}:\d{2}/ });
    await slot.first().waitFor({ timeout: 15000 });
    await slot.nth(Math.min(1, (await slot.count()) - 1)).click();
    await page.getByRole('button', { name: /Next: Review/ }).click();
    await page.locator('#policy-agree').check();
  }
  await page.getByRole('button', { name: /Confirm & Submit/ }).click();
  await page.getByRole('button', { name: /Confirm & Submit|Reserving/ }).waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const successHeading = page.getByRole('heading').filter({ hasText: /(Request|Submitted|Received|Success|Booked)/i });
  check(run, 'Success step rendered after fake 201', (await successHeading.count()) > 0);
  if (await successHeading.count()) check(run, 'Success heading on-screen after submit', await successHeading.first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= -1 && r.top < window.innerHeight; }));
  await snap('5-success');

  const unexpected = blockedWrites.filter((w) => !/notifications/.test(w));
  check(run, 'No unexpected write requests attempted', unexpected.length === 0, unexpected.join(', '));
  const realErrors = consoleErrors.filter((e) => !/status of 40[19]/.test(e));
  check(run, 'No console errors', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
  await context.close();
}
await browser.close();

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} booking checks passed`);
process.exit(failed.length ? 1 : 0);
