import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely load environment variables from frontend/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const isLocalTarget = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(
  baseURL.replace(/\/+$/, '')
);

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
  // Automatically spin up Vite dev server when testing against localhost
  webServer: isLocalTarget
    ? {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      }
    : undefined,
});
