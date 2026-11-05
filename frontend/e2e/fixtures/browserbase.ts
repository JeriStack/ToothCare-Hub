import { test as base, expect, Page } from '@playwright/test';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables safely
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface BrowserbaseTestFixtures {
  browserbaseSessionId: string | null;
}

/**
 * Extended Playwright test fixture that routes tests either to a remote Browserbase session
 * via chromium.connectOverCDP() or to a standard local Chromium instance.
 */
export const test = base.extend<BrowserbaseTestFixtures>({
  browserbaseSessionId: [null, { option: true }],

  page: async ({ page: localPage, baseURL }, use, testInfo) => {
    const isRemote =
      testInfo.project.name === 'remote-browserbase' ||
      process.env.USE_BROWSERBASE === 'true';

    // If not remote, use default local Playwright page
    if (!isRemote) {
      await use(localPage);
      return;
    }

    const rawBaseUrl =
      process.env.PLAYWRIGHT_BASE_URL || baseURL || 'http://localhost:5173';
    const effectiveBaseUrl = rawBaseUrl.replace(/\/+$/, '');

    // A remote cloud browser cannot reach 'localhost' or '127.0.0.1' without a tunnel
    const isLocalhost =
      /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(
        effectiveBaseUrl
      );

    if (isLocalhost) {
      testInfo.skip(
        true,
        `[Browserbase] Remote cloud browser cannot reach local host "${effectiveBaseUrl}". For local testing, run 'npm run test:e2e:local'. For remote cloud testing, expose port 5173 via a public tunnel (e.g. ngrok http 5173) and set PLAYWRIGHT_BASE_URL=<tunnel-url> in .env.`
      );
      return;
    }

    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing BROWSERBASE_API_KEY. Please provide a valid Browserbase API key in your .env file.'
      );
    }

    const projectId = process.env.BROWSERBASE_PROJECT_ID || undefined;
    const bb = new Browserbase({ apiKey });

    // 1. Create remote Browserbase session
    const session = await bb.sessions.create({
      projectId,
      browserSettings: {
        recordSession: true, // Record session video for replay
        logSession: true,    // Stream and store browser logs
      },
    });

    console.log(`\n======================================================`);
    console.log(`[Browserbase] Remote Session Started: ${session.id}`);
    console.log(`[Browserbase] Live Inspector: https://browserbase.com/sessions/${session.id}`);
    console.log(`======================================================\n`);

    // 2. Connect Playwright to the remote browser session over CDP
    const remoteBrowser = await chromium.connectOverCDP(session.connectUrl);
    const defaultContext =
      remoteBrowser.contexts()[0] ??
      (await remoteBrowser.newContext({ baseURL: effectiveBaseUrl }));
    const page =
      defaultContext.pages()[0] ?? (await defaultContext.newPage());

    // Intercept page.goto to ensure relative URLs always resolve against effectiveBaseUrl
    const originalGoto = page.goto.bind(page);
    page.goto = async (url: string, options?: Parameters<typeof originalGoto>[1]) => {
      let resolvedUrl = url;
      if (!/^https?:\/\//i.test(url)) {
        const cleanPath = url.startsWith('/') ? url : `/${url}`;
        resolvedUrl = `${effectiveBaseUrl}${cleanPath}`;
      }
      return originalGoto(resolvedUrl, options);
    };

    try {
      // 3. Run the test with the remote page
      await use(page);
    } finally {
      // 4. Clean up remote browser connection and ensure session completes
      await page.close().catch(() => {});
      await remoteBrowser.close().catch(() => {});
      console.log(`[Browserbase] Remote Session ${session.id} closed cleanly.`);
    }
  },
});

export { expect };
