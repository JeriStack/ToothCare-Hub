import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely load environment variables from frontend/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const explicitBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const e2ePort = Number(process.env.PLAYWRIGHT_PORT || 5174);
const baseURL = explicitBaseURL || `http://localhost:${e2ePort}`;
const shouldStartManagedWebServer = !explicitBaseURL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially for predictable cloud session management
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker prevents opening excessive concurrent cloud sessions
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    // 1. Local Headless Chromium
    {
      name: 'local-chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // 2. Remote Cloud Sessions via Browserbase
    {
      name: 'remote-browserbase',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  // Automatically spin up a fresh Vite dev server on a dedicated E2E port
  // when PLAYWRIGHT_BASE_URL is not explicitly set (avoids reusing stale servers on :5173)
  webServer: shouldStartManagedWebServer
    ? {
        command: `node ./node_modules/vite/bin/vite.js --port ${e2ePort} --strictPort`,
        port: e2ePort,
        reuseExistingServer: false,
        timeout: 60000,
      }
    : undefined,
});
