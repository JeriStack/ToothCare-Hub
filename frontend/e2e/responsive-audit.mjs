/**
 * Responsive audit harness (manual / local tool, not part of CI).
 *
 * Logs in as each seeded demo role against a running dev stack (Vite on :5173
 * proxying to the API), visits every portal route at every target viewport in
 * both themes, and records layout metrics:
 *   - page-level horizontal overflow (documentElement.scrollWidth > clientWidth)
 *   - elements that poke outside the viewport (excluding intentional scroll containers)
 *   - visible interactive controls smaller than 24x24 CSS px (WCAG 2.2 SC 2.5.8)
 *   - console errors and failed network requests
 *
 * Usage:
 *   node e2e/responsive-audit.mjs [--roles=admin,patient] [--viewports=320,768] [--themes=light] [--shots]
 * Env: AUDIT_BASE_URL (default http://localhost:5173), AUDIT_PASSWORD (default Password123!)
 * Output: test-results/responsive-audit/report.json (+ screenshots with --shots)
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173';
const PASSWORD = process.env.AUDIT_PASSWORD || 'Password123!';
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1].split(',') : fallback;
};
const SHOTS = process.argv.includes('--shots');

const ALL_VIEWPORTS = [
  [320, 568], [375, 812], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
];
const viewports = arg('viewports', null)
  ? ALL_VIEWPORTS.filter(([w]) => arg('viewports').includes(String(w)))
  : ALL_VIEWPORTS;
const themes = arg('themes', ['light', 'dark']);

const ROLES = {
  admin: {
    email: 'admin@toothcare.com',
    routes: ['/admin', '/admin/triage', '/admin/patients', '/admin/services', '/admin/dentists',
      '/admin/schedules', '/admin/users', '/admin/roles', '/admin/audit', '/admin/reports',
      '/admin/system', '/admin/profile'],
  },
  receptionist: {
    email: 'receptionist@toothcare.com',
    routes: ['/receptionist', '/receptionist/triage', '/receptionist/patients', '/receptionist/dentists',
      '/receptionist/schedules', '/receptionist/profile'],
  },
  dentist: {
    email: 'dentist@toothcare.com',
    routes: ['/dentist', '/dentist/appointments', '/dentist/treatment-records', '/dentist/profile'],
  },
  patient: {
    email: 'patient@toothcare.com',
    routes: ['/patient', '/patient/book', '/patient/services', '/patient/dentists',
      '/patient/appointments', '/patient/notifications', '/patient/profile'],
  },
  public: {
    email: null,
    routes: ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email'],
  },
};
const roles = arg('roles', Object.keys(ROLES));

const outDir = path.resolve('test-results', 'responsive-audit');
fs.mkdirSync(outDir, { recursive: true });

async function login(context, email) {
  const api = context.request;
  const csrfRes = await api.get(`${BASE}/api/v1/auth/csrf-token`);
  const csrf = (await csrfRes.json())?.data?.csrf_token;
  const res = await api.post(`${BASE}/api/v1/auth/login`, {
    data: { email, password: PASSWORD, remember_me: false },
    headers: { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`);
}

/** Runs inside the page. */
function measure() {
  const vw = document.documentElement.clientWidth;
  const root = document.documentElement;
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const insideScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
        if (p.scrollWidth > p.clientWidth + 1 || ox !== 'visible') return true;
      }
    }
    return false;
  };
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${txt}"`;
  };

  const overflowing = [];
  const smallTargets = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !insideScroller(el) && getComputedStyle(el).position !== 'fixed') {
      if (overflowing.length < 8) overflowing.push({ el: describe(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
    if (el.matches('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=menuitem]')) {
      if (el.closest('.sr-only') || el.matches('.sr-only')) continue;
      const w = Math.round(r.width), h = Math.round(r.height);
      // Inline text links within paragraphs are exempt (WCAG 2.5.8 inline exception)
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
      if (!inline && (w < 24 || h < 24)) {
        if (smallTargets.length < 8) smallTargets.push({ el: describe(el), w, h });
      }
    }
  }
  return {
    pageOverflow: root.scrollWidth > vw + 1,
    scrollWidth: root.scrollWidth,
    clientWidth: vw,
    bodyScrollWidth: document.body.scrollWidth,
    overflowing,
    smallTargets,
    isDark: root.classList.contains('dark'),
  };
}

const browser = await chromium.launch();
const results = [];
let pagesVisited = 0;

for (const roleName of roles) {
  const role = ROLES[roleName];
  for (const theme of themes) {
    const context = await browser.newContext({ baseURL: BASE, colorScheme: 'light' });
    await context.addInitScript((t) => {
      try { localStorage.setItem('toothcare_theme', t); } catch { /* noop */ }
    }, theme);
    if (role.email) await login(context, role.email);
    for (const [w, h] of viewports) {
      const page = await context.newPage();
      await page.setViewportSize({ width: w, height: h });
      const consoleErrors = [];
      const failed = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
      page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
      for (const route of role.routes) {
        try {
          await page.goto(route, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(350);
          const m = await page.evaluate(measure);
          pagesVisited++;
          const entry = { role: roleName, route, viewport: `${w}x${h}`, theme, ...m, consoleErrors: [...consoleErrors], failed: [...failed] };
          results.push(entry);
          if (SHOTS) {
            const f = `${roleName}${route.replace(/\//g, '_') || '_root'}__${w}__${theme}.png`;
            await page.screenshot({ path: path.join(outDir, f), fullPage: false });
          }
          consoleErrors.length = 0; failed.length = 0;
        } catch (e) {
          results.push({ role: roleName, route, viewport: `${w}x${h}`, theme, error: String(e).slice(0, 200) });
        }
      }
      await page.close();
    }
    await context.close();
  }
}
await browser.close();

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.error || r.pageOverflow || r.overflowing?.length);
console.log(`Pages measured: ${pagesVisited}. With page overflow / off-screen elements / errors: ${bad.length}`);
for (const r of bad) {
  console.log(`${r.error ? 'ERR ' : r.pageOverflow ? 'PAGE' : 'ELEM'} ${r.role} ${r.route} @${r.viewport} ${r.theme}` +
    (r.error ? ` :: ${r.error}` : ` sw=${r.scrollWidth}/${r.clientWidth} :: ${(r.overflowing || []).slice(0, 2).map((o) => o.el).join(' | ')}`));
}
