/**
 * Dialog probe (local tool; needs the dev stack + seeded demo accounts).
 *
 * On each page, clicks buttons in <main> whose label suggests they open a dialog, and for every
 * overlay (`.fixed.inset-0` with z-50) that appears, measures:
 *   fit (inside viewport), semantics (role=dialog, aria-modal, accessible name),
 *   focus moved inside, Tab stays inside, Escape closes, focus returns to trigger,
 *   body scroll locked, close button size, last action reachable by scrolling the dialog,
 *   form-field font size on phones (iOS zoom).
 * SAFETY: every non-GET /api/ request is answered with a fake 200; nothing is written.
 *
 * Usage: node e2e/dialog-check.mjs [--viewports=320,1280] [--shots]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Password123!';
const SHOTS = process.argv.includes('--shots');
const vpArg = process.argv.find((a) => a.startsWith('--viewports='));
const VIEWPORTS = (vpArg ? vpArg.split('=')[1].split(',').map(Number) : [320, 1280]).map((w) => ({ w, h: w === 844 ? 390 : w < 768 ? 640 : 800 }));
const outDir = path.resolve('test-results', 'dialogs');
fs.mkdirSync(outDir, { recursive: true });

const OPENERS = /^(\+\s*)?(add|new|provision|register|edit|view|details|view record|cancel|reschedule|request|decline|reject|create|record|leave|holiday|shift|log|manage|privacy|terms|patient privacy|appointment terms|inspect|open|review)\b/i;
const PAGES = [
  { email: 'admin@toothcare.com', routes: ['/admin/triage', '/admin/patients', '/admin/services', '/admin/dentists', '/admin/schedules', '/admin/users', '/admin/audit'] },
  { email: 'receptionist@toothcare.com', routes: ['/receptionist'] },
  { email: 'dentist@toothcare.com', routes: ['/dentist', '/dentist/treatment-records'] },
  { email: 'patient@toothcare.com', routes: ['/patient', '/patient/appointments', '/patient/services', '/patient/dentists'] },
  { email: null, routes: ['/'] },
];

const overlaySelector = 'div.fixed.inset-0[class*="z-50"]';

function inspectOverlay(sel) {
  const overlays = [...document.querySelectorAll(sel)].filter((o) => o.getBoundingClientRect().width > 0);
  const overlay = overlays[overlays.length - 1];
  if (!overlay) return null;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  // Panel = largest non-backdrop child
  const kids = [...overlay.querySelectorAll(':scope > *')].filter((k) => k.getAttribute('aria-hidden') !== 'true');
  const panel = kids.sort((a, b) => b.getBoundingClientRect().height * b.getBoundingClientRect().width - a.getBoundingClientRect().height * a.getBoundingClientRect().width)[0] || overlay;
  const pr = panel.getBoundingClientRect();
  const dialogEl = overlay.closest('[role=dialog]') || overlay.querySelector('[role=dialog]') || (overlay.getAttribute('role') === 'dialog' ? overlay : null);
  const named = !!dialogEl && !!(dialogEl.getAttribute('aria-labelledby') || dialogEl.getAttribute('aria-label'));
  const heading = (panel.querySelector('h1,h2,h3,h4')?.textContent || '').trim().slice(0, 50);
  const buttons = [...panel.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width);
  const closeBtn = buttons.find((b) => /close|cancel|dismiss/i.test(b.getAttribute('aria-label') || '') || (b.textContent.trim() === '' && b.querySelector('svg')))
    || buttons.find((b) => /^(cancel|close|keep|no|dismiss|go back|back)\b/i.test(b.textContent.trim()));
  const cb = closeBtn?.getBoundingClientRect();
  const smallFont = [...panel.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select')]
    .filter((el) => el.getBoundingClientRect().width && parseFloat(getComputedStyle(el).fontSize) < 16).length;
  const smallTargets = [...panel.querySelectorAll('button, input[type=checkbox], input[type=radio], a[href], select')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24); })
    .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
  return {
    heading,
    fitsX: pr.left >= -1 && pr.right <= vw + 1,
    // Tall panels may exceed short screens, as long as the overlay scrolls and the panel top is visible at open
    fitsY: (pr.top >= -1 && pr.bottom <= vh + 1) || (pr.top >= -1 && pr.top < vh && ['auto', 'scroll'].includes(getComputedStyle(overlay).overflowY) && overlay.scrollHeight > overlay.clientHeight),
    panel: `${Math.round(pr.width)}x${Math.round(pr.height)} @${Math.round(pr.left)},${Math.round(pr.top)}`,
    role: !!dialogEl,
    modal: dialogEl?.getAttribute('aria-modal') === 'true',
    named,
    focusInside: overlay.contains(document.activeElement),
    bodyLocked: getComputedStyle(document.body).overflow === 'hidden' || document.body.style.overflow === 'hidden',
    closeSize: cb ? `${Math.round(cb.width)}x${Math.round(cb.height)}` : 'none',
    closeOk: !!cb && cb.width >= 24 && cb.height >= 24,
    smallFont,
    smallTargets,
  };
}

async function lastActionReachable(page) {
  return page.evaluate((sel) => {
    const overlays = [...document.querySelectorAll(sel)];
    const overlay = overlays[overlays.length - 1];
    if (!overlay) return false;
    for (const el of overlay.querySelectorAll('*')) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    }
    if (getComputedStyle(overlay).overflowY !== 'visible') overlay.scrollTop = overlay.scrollHeight;
    const btns = [...overlay.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width);
    const last = btns[btns.length - 1];
    if (!last) return true;
    const r = last.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight + 1;
  }, overlaySelector);
}

const browser = await chromium.launch();
const rows = [];
for (const vp of VIEWPORTS) {
  for (const group of PAGES) {
    const context = await browser.newContext({ baseURL: BASE, viewport: { width: vp.w, height: vp.h }, hasTouch: vp.w < 1024, timezoneId: 'Asia/Manila' });
    if (group.email) {
      const csrf = (await (await context.request.get('/api/v1/auth/csrf-token')).json()).data.csrf_token;
      await context.request.post('/api/v1/auth/login', { data: { email: group.email, password: PASSWORD, remember_me: false }, headers: { 'X-CSRF-Token': csrf } });
    }
    await context.route('**/api/**', (route) => (route.request().method() === 'GET'
      ? route.continue()
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) })));
    const page = await context.newPage();
    for (const route of group.routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const labels = await page.evaluate((reSrc) => {
        const re = new RegExp(reSrc, 'i');
        const seen = new Set();
        return [...document.querySelectorAll('main button, footer button')]
          .filter((b) => b.getBoundingClientRect().width && !b.disabled)
          .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' '))
          .filter((t) => re.test(t) && !seen.has(t) && seen.add(t))
          .slice(0, 12);
      }, OPENERS.source);
      const seenHeadings = new Set();
      for (const label of labels) {
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(250);
        const trigger = page.locator('main button, footer button').filter({ hasText: label }).first();
        const byAria = page.locator(`main button[aria-label="${label.replace(/"/g, '\\"')}"]`).first();
        const target = (await trigger.count()) ? trigger : byAria;
        if (!(await target.count())) continue;
        try { await target.scrollIntoViewIfNeeded(); await target.click({ timeout: 3000 }); } catch { continue; }
        await page.waitForTimeout(350);
        const info = await page.evaluate(inspectOverlay, overlaySelector);
        if (!info || seenHeadings.has(info.heading)) continue;
        seenHeadings.add(info.heading);
        // Tab containment: press Tab 25 times and see whether focus ever leaves the overlay
        let tabLeaks = false;
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press('Tab');
          const inside = await page.evaluate((sel) => { const o = [...document.querySelectorAll(sel)].pop(); return !!o && o.contains(document.activeElement); }, overlaySelector);
          if (!inside) { tabLeaks = true; break; }
        }
        const reachable = await lastActionReachable(page);
        if (SHOTS) await page.screenshot({ path: path.join(outDir, `${vp.w}-${route.replace(/\//g, '_')}-${info.heading.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.png`) });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        const escCloses = !(await page.evaluate((sel) => [...document.querySelectorAll(sel)].some((o) => o.getBoundingClientRect().width && !o.matches('[data-testid=portal-drawer-backdrop]')), overlaySelector));
        const focusReturned = escCloses ? await page.evaluate((l) => { const a = document.activeElement; return !!a && a.tagName === 'BUTTON' && ((a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ') === l); }, label) : false;
        rows.push({ vp: vp.w, route, trigger: label.slice(0, 28), ...info, tabTrapped: !tabLeaks, reachable, escCloses, focusReturned });
      }
    }
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(rows, null, 2));

const checks = ['fitsX', 'fitsY' /* fits or scrolls */, 'role', 'modal', 'named', 'focusInside', 'tabTrapped', 'escCloses', 'focusReturned', 'bodyLocked', 'closeOk', 'reachable'];
console.log(`Dialogs inspected: ${rows.length}`);
for (const k of checks) {
  const bad = rows.filter((r) => !r[k]);
  console.log(`${k.padEnd(14)} ${rows.length - bad.length}/${rows.length}${bad.length ? '  e.g. ' + bad.slice(0, 2).map((r) => `${r.vp} ${r.route} "${r.heading}"`).join('; ') : ''}`);
}
const fontBad = rows.filter((r) => r.vp < 640 && r.smallFont > 0);
console.log(`phone fields<16px ${fontBad.length} dialogs`);
const tgt = rows.filter((r) => r.smallTargets.length);
console.log(`small targets  ${tgt.length} dialogs  e.g. ${tgt.slice(0, 3).map((r) => r.smallTargets[0]).join(' | ')}`);
