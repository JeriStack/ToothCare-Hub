/**
 * Stress probe (local tool; needs the dev stack + seeded demo accounts). Three sections:
 *   A  tables: real list responses are enlarged to a full page with long unbroken text, then
 *      checked for overflow, cell bleed/overlap, small targets and reachable pagination.
 *   B  skeleton parity: API reads are delayed so skeletons render; measures layout shift (CLS)
 *      between loading and loaded states, and overflow while the skeleton is showing.
 *   C  permissions: the same nav items and action buttons at every viewport, and direct-URL
 *      access attempts by roles that must not reach a screen.
 * SAFETY: only GET responses are altered, in the browser. Every non-GET request is faked.
 * Usage: node e2e/stress-check.mjs [--sections=A,B,C] [--shots]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Password123!';
const SHOTS = process.argv.includes('--shots');
const secArg = process.argv.find((a) => a.startsWith('--sections='));
const SECTIONS = secArg ? secArg.split('=')[1].split(',') : ['A', 'B', 'C'];
const listArg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1].split(',') : null; };
const ONLY_ROLES = listArg('roles');
const ONLY_WIDTHS = listArg('widths')?.map(Number);
const outDir = path.resolve('test-results', 'stress');
fs.mkdirSync(outDir, { recursive: true });

const EMAIL = { admin: 'admin@toothcare.com', receptionist: 'receptionist@toothcare.com', dentist: 'dentist@toothcare.com', patient: 'patient@toothcare.com' };
const results = [];
const check = (group, name, ok, detail = '') => { results.push({ group, name, ok, detail }); if (!ok) console.log(`FAIL  [${group}] ${name}${detail ? ' :: ' + detail : ''}`); };

async function newContext(browser, role, { w, h, theme = 'light' }) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768, timezoneId: 'Asia/Manila' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('toothcare_theme', t); } catch { /* noop */ } }, theme);
  if (role) {
    const csrf = (await (await ctx.request.get('/api/v1/auth/csrf-token')).json()).data.csrf_token;
    const res = await ctx.request.post('/api/v1/auth/login', { data: { email: EMAIL[role], password: PASSWORD, remember_me: false }, headers: { 'X-CSRF-Token': csrf } });
    if (!res.ok()) throw new Error('login failed ' + role);
  }
  return ctx;
}

const LONG_KEY = /name|email|title|description|notes|address|license|specialization|summary|reason|complaint|action|module|event|diagnosis|procedure|advice|alerts|phone/i;
function enlarge(rows, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const src = rows[i % rows.length];
    const row = JSON.parse(JSON.stringify(src));
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== 'string' || !v || !LONG_KEY.test(k) || /^\d{4}-\d{2}-\d{2}/.test(v)) continue;
      if (/email/i.test(k)) row[k] = `extremely.long.mailbox.name.${'x'.repeat(28)}${i}@subdomain.example-clinic-network.org`;
      else row[k] = i % 2 === 0 ? `${v} ${'Unbroken'.repeat(8)}${i}` : `${v} — a deliberately long descriptive sentence that must wrap onto several lines without hiding neighbouring columns (${i})`;
    }
    if ('id' in row && typeof row.id === 'number') row.id = 100000 + i;
    out.push(row);
  }
  return out;
}

async function installEnlarger(ctx, { delayMs = 0, enlargeLists = false } = {}) {
  const state = { pagesRequested: [], enlarged: 0 };
  await ctx.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    }
    const skip = /\/auth\/|\/csrf-token|unread-count/.test(url.pathname);
    if (delayMs && !skip) await new Promise((r) => setTimeout(r, delayMs));
    if (!enlargeLists || skip) return route.continue();
    if (url.searchParams.get('page')) state.pagesRequested.push(url.searchParams.get('page'));
    const res = await route.fetch();
    let json;
    try { json = await res.json(); } catch { return route.fulfill({ response: res }); }
    const d = json?.data;
    // The demo dentist owns no treatment records, so synthesise one to clone from
    if (d && Array.isArray(d.items) && d.items.length === 0 && /\/treatment-records$/.test(url.pathname)) {
      d.items = [{ id: 1, appointment_id: 1, created_at: '2026-11-13 09:00:00', locked_at: '2026-11-14 09:00:00', is_locked: 0, teeth_treated: [11, 12, 46],
        patient_first_name: 'Patient', patient_last_name: 'Name', patient_gender: 'FEMALE', patient_phone: '+639171234567', patient_date_of_birth: '1990-01-01', patient_medical_alerts: 'None recorded',
        dentist_first_name: 'Maria', dentist_last_name: 'Santos', dentist_license_number: 'PRC-DEN-001234', dentist_specialization: 'General Dentistry',
        service_name: 'Composite Tooth Filling', diagnosis: 'Dental caries on tooth 46', procedure_notes: 'Composite restoration placed', prescription_notes: 'Paracetamol 500mg prn', home_care_advice: 'Avoid hard food for 24 hours' }];
    }
    if (d && Array.isArray(d.items) && d.items.length) {
      const per = Number(d.meta?.per_page) || 20;
      state.lastPer = per;
      d.items = enlarge(d.items, per);
      d.meta = { ...(d.meta || {}), total: per * 5, per_page: per, page: Number(url.searchParams.get('page')) || 1, last_page: 5 };
      state.enlarged++;
    } else if (Array.isArray(d) && d.length && d.length < 100 && typeof d[0] === 'object') {
      json.data = enlarge(d, Math.max(d.length, 12));
      state.enlarged++;
    }
    return route.fulfill({ response: res, json });
  });
  return state;
}

function measure() {
  const vw = document.documentElement.clientWidth;
  const rect = (el) => el.getBoundingClientRect();
  const vis = (el) => { const r = rect(el); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const inScroller = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (['auto', 'scroll', 'hidden', 'clip'].includes(ox)) return true; } return false; };
  const offscreen = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = rect(el);
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && getComputedStyle(el).position !== 'fixed' && offscreen.length < 5) offscreen.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  // Table-cell bleed: content that paints outside its own cell, and neighbouring cells that overlap
  let bleed = 0, overlap = 0, rows = 0, clipped = 0;
  const bleedEx = [];
  for (const tr of document.querySelectorAll('main tbody tr')) {
    if (!vis(tr)) continue;
    rows++;
    const tds = [...tr.children].filter((c) => c.tagName === 'TD' && vis(c));
    for (const td of tds) {
      const tr_ = rect(td);
      const ox = getComputedStyle(td).overflowX;
      for (const d of td.querySelectorAll('*')) {
        if (!vis(d)) continue;
        const r = rect(d);
        if (r.right > tr_.right + 2 && ox === 'visible' && getComputedStyle(d).whiteSpace !== 'nowrap') { bleed++; if (bleedEx.length < 3) bleedEx.push((d.textContent || '').trim().slice(0, 25)); break; }
        if (ox !== 'visible' && td.scrollWidth > td.clientWidth + 1) { clipped++; break; }
      }
    }
    for (let i = 0; i < tds.length; i++) for (let j = i + 1; j < tds.length; j++) {
      const a = rect(tds[i]), b = rect(tds[j]);
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 3 && iy > 3) overlap++;
    }
  }
  const small = [];
  for (const el of document.querySelectorAll('main button, main a[href], main input:not([type=hidden]), main select')) {
    if (!vis(el) || el.closest('.sr-only')) continue;
    const r = rect(el);
    if ((r.width < 24 || r.height < 24) && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline') && small.length < 5) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const pager = [...document.querySelectorAll('main button')].filter((b) => /^(next|previous|prev)\b|^[‹›«»]|next page|previous page/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()) && vis(b));
  const pagerBad = pager.filter((b) => { const r = rect(b); return r.right > vw + 1 || r.left < -1 || r.width < 24 || r.height < 24; }).length;
  return { pageOverflow: document.documentElement.scrollWidth > vw + 1, sw: document.documentElement.scrollWidth, vw, offscreen, rows, bleed, bleedEx, overlap, clipped, small, pager: pager.length, pagerBad };
}

const browser = await chromium.launch();

// ---------------------------------------------------------------- A: tables
if (SECTIONS.includes('A')) {
  const TABLES = [
    ['admin', '/admin/patients'], ['admin', '/admin/dentists'], ['admin', '/admin/services'], ['admin', '/admin/users'],
    ['admin', '/admin/audit'], ['admin', '/admin/triage'], ['receptionist', '/receptionist/triage'],
    ['dentist', '/dentist/appointments'], ['dentist', '/dentist/treatment-records'],
    ['patient', '/patient/appointments'], ['patient', '/patient/notifications'], ['patient', '/patient/services'],
  ];
  const VPS = [{ w: 320, h: 568 }, { w: 375, h: 812 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1440, h: 900 }, { w: 320, h: 568, theme: 'dark' }];
  for (const vp of VPS) {
    for (const role of ['admin', 'receptionist', 'dentist', 'patient']) {
      const ctx = await newContext(browser, role, vp);
      const state = await installEnlarger(ctx, { enlargeLists: true });
      const page = await ctx.newPage();
      for (const [r, route] of TABLES.filter(([r]) => r === role)) {
        const g = `A ${vp.w}${vp.theme ? ' ' + vp.theme : ''} ${route}`;
        try {
          const enlargedBefore = state.enlarged;
          await page.goto(route, { waitUntil: 'networkidle' });
          await page.waitForTimeout(400);
          const m = await page.evaluate(measure);
          // Guard against a probe that passes only because the stress data never arrived
          check(g, 'stress data was applied to the list response', state.enlarged > enlargedBefore, 'enlarged=' + (state.enlarged - enlargedBefore));
          if (m.rows > 0) check(g, 'table rendered a full enlarged page', m.rows >= Math.min(10, state.lastPer || 10), `rows=${m.rows} per_page=${state.lastPer}`);
          check(g, 'no page overflow', !m.pageOverflow, `${m.sw}/${m.vw}`);
          check(g, 'no off-screen elements', m.offscreen.length === 0, m.offscreen.slice(0, 2).join(' | '));
          check(g, 'no cell bleed', m.bleed === 0, `${m.bleed} e.g. ${m.bleedEx.join(' | ')}`);
          check(g, 'no overlapping cells', m.overlap === 0, String(m.overlap));
          check(g, 'no targets < 24px', m.small.length === 0, m.small.slice(0, 3).join(' | '));
          check(g, 'pagination controls inside viewport and >= 24px', m.pagerBad === 0, `${m.pagerBad}/${m.pager}`);
          if (SHOTS && vp.w === 320 && !vp.theme) await page.screenshot({ path: path.join(outDir, `A-${role}${route.replace(/\//g, '_')}-320.png`), fullPage: false });
          // pagination really works when it is present
          const next = page.locator('main button').filter({ hasText: /^\s*next\b/i }).first();
          if (m.rows > 0 && (await next.count()) && !(await next.isDisabled())) {
            const before = state.pagesRequested.length;
            await next.scrollIntoViewIfNeeded();
            await next.click();
            await page.waitForTimeout(700);
            check(g, 'Next page requests page 2', state.pagesRequested.slice(before).includes('2'), state.pagesRequested.slice(before).join(','));
          }
        } catch (e) { check(g, 'page ran', false, String(e).slice(0, 120)); }
      }
      await ctx.close();
    }
  }
}

// ---------------------------------------------------------------- B: skeleton parity
if (SECTIONS.includes('B')) {
  const ROUTES = {
    admin: ['/admin', '/admin/triage', '/admin/patients', '/admin/services', '/admin/dentists', '/admin/schedules', '/admin/users', '/admin/roles', '/admin/audit', '/admin/reports', '/admin/system'],
    receptionist: ['/receptionist'], dentist: ['/dentist', '/dentist/appointments', '/dentist/treatment-records'],
    patient: ['/patient', '/patient/book', '/patient/services', '/patient/dentists', '/patient/appointments', '/patient/notifications'],
  };
  const VPS = [{ w: 320, h: 568 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }, { w: 320, h: 568, theme: 'dark' }].filter((v) => !ONLY_WIDTHS || ONLY_WIDTHS.includes(v.w));
  for (const vp of VPS) {
    for (const [role, routes] of Object.entries(ROUTES)) {
      if (ONLY_ROLES && !ONLY_ROLES.includes(role)) continue;
      const ctx = await newContext(browser, role, vp);
      await installEnlarger(ctx, { delayMs: 1800 });
      await ctx.addInitScript(() => {
        window.__cls = 0; window.__shifts = [];
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(Math.round(e.value * 1000) / 1000); } }).observe({ type: 'layout-shift', buffered: true });
      });
      const page = await ctx.newPage();
      for (const route of routes) {
        const g = `B ${vp.w}${vp.theme ? ' ' + vp.theme : ''} ${route}`;
        try {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          // The dev server needs a moment to mount React; measure the skeleton once <main> exists
          await page.waitForSelector('main', { timeout: 20000 });
          await page.waitForTimeout(500);
          const during = await page.evaluate(() => {
            const sk = document.querySelectorAll('[aria-busy="true"], [class*="animate-pulse"], [class*="skeleton" i], [data-skeleton]').length;
            return { sk, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, h: document.querySelector('main')?.getBoundingClientRect().height || 0 };
          });
          if (SHOTS && vp.w === 320 && !vp.theme) await page.screenshot({ path: path.join(outDir, `B-${role}${route.replace(/\//g, '_')}-skeleton-320.png`) });
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(500);
          const after = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts, h: document.querySelector('main')?.getBoundingClientRect().height || 0, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
          check(g, 'skeleton visible while loading', during.sk > 0, `count=${during.sk}`);
          check(g, 'no overflow while skeleton shows', !during.overflow, `${during.sw}/${during.vw}`);
          check(g, 'no overflow after load', !after.overflow);
          check(g, 'layout shift (CLS) <= 0.1', after.cls <= 0.1, `cls=${after.cls.toFixed(3)} shifts=${after.shifts.join(',')}`);
        } catch (e) { check(g, 'page ran', false, String(e).slice(0, 120)); }
      }
      await ctx.close();
    }
  }
}

// ---------------------------------------------------------------- C: permissions
if (SECTIONS.includes('C')) {
  const labelSet = (page, sel) => page.evaluate((s) => [...new Set([...document.querySelectorAll(s)]
    .filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && (r.width > 0 || el.closest('#portal-sidebar')); })
    .map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40))
    .filter((t) => t && !/^sort\b|^sort by|sort direction|navigation menu|close navigation/i.test(t)))].sort(), sel);
  const openDrawer = async (page) => { const b = page.getByRole('button', { name: 'Navigation menu' }); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(350); return true; } return false; };
  const PAGES = {
    admin: ['/admin', '/admin/triage', '/admin/users', '/admin/roles', '/admin/audit'],
    receptionist: ['/receptionist', '/receptionist/triage', '/receptionist/patients'],
    dentist: ['/dentist', '/dentist/appointments'], patient: ['/patient', '/patient/appointments'],
  };
  for (const [role, routes] of Object.entries(PAGES)) {
    const sets = {};
    for (const vp of [{ w: 320, h: 568 }, { w: 768, h: 1024 }, { w: 1440, h: 900 }]) {
      const ctx = await newContext(browser, role, vp);
      await installEnlarger(ctx, {});
      const page = await ctx.newPage();
      await page.goto(routes[0], { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const drawerUsed = await openDrawer(page);
      sets[vp.w] = { nav: await labelSet(page, '#portal-sidebar a, #portal-sidebar button'), actions: {} };
      if (drawerUsed) await page.keyboard.press('Escape');
      for (const route of routes) {
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);
        sets[vp.w].actions[route] = await labelSet(page, 'main button, main a[href]');
      }
      await ctx.close();
    }
    const ref = sets[1440];
    for (const w of [320, 768]) {
      const navDiff = [...new Set([...ref.nav.filter((x) => !sets[w].nav.includes(x)), ...sets[w].nav.filter((x) => !ref.nav.includes(x))])];
      check(`C ${role}`, `nav items identical at ${w}px vs 1440px`, navDiff.length === 0, navDiff.slice(0, 5).join(' | '));
      for (const route of routes) {
        const a = ref.actions[route], b = sets[w].actions[route];
        const diff = [...a.filter((x) => !b.includes(x)), ...b.filter((x) => !a.includes(x))];
        check(`C ${role}`, `${route}: same actions at ${w}px as 1440px`, diff.length === 0, diff.slice(0, 6).join(' | '));
      }
    }
  }
  // Direct URL attempts: restricted roles must never see the restricted screen at any width
  const DENY = [
    ['patient', '/admin/users', /User & Account Management|Provision Staff/i], ['patient', '/admin/audit', /Audit Trail/i], ['patient', '/dentist/treatment-records', /Treatment Records/i],
    ['dentist', '/admin/users', /User & Account Management|Provision Staff/i], ['dentist', '/admin/audit', /Audit Trail/i], ['dentist', '/patient/book', /Book Dental Appointment/i],
    ['receptionist', '/admin/audit', /System Audit Trail/i], ['receptionist', '/admin/users', /User & Account Management/i], ['receptionist', '/admin/roles', /Dynamic Role-Based Access Control/i], ['receptionist', '/admin/system', /System Health/i],
  ];
  for (const [role, route, re] of DENY) {
    for (const w of [320, 1440]) {
      const ctx = await newContext(browser, role, { w, h: w < 768 ? 700 : 900 });
      await installEnlarger(ctx, {});
      const page = await ctx.newPage();
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      const body = await page.locator('main').innerText().catch(() => '');
      check(`C deny`, `${role} -> ${route} @${w}: restricted screen not shown`, !re.test(body), body.replace(/\s+/g, ' ').slice(0, 70));
      await ctx.close();
    }
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} stress checks passed`);
process.exit(failed.length ? 1 : 0);
