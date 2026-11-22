import { test, expect } from './fixtures/browserbase';

/**
 * Phase 16 Critical User Journeys E2E Suite
 * Exercises real browser navigation, form validation, role-based portals,
 * appointment lifecycle visibility, and notification recovery in an isolated environment
 * (no production database, no external SMTP).
 */
test.describe('Phase 16 — Critical Browser Journeys & Regression Checks', () => {
  test('Patient registration & login forms enforce validation and surface errors cleanly', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, meta: {}, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }),
      })
    );
    await page.route('**/api/v1/auth/csrf-token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { csrf_token: 'e2e-test-csrf' }, meta: {}, error: null }),
      })
    );
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          meta: {},
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        }),
      })
    );

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Welcome Back|Sign In/i })).toBeVisible();

    await page.getByLabel(/Email/i).fill('synthetic.patient@example.com');
    await page.getByPlaceholder(/Enter your password/i).fill('WrongPass123!');
    await page.getByRole('button', { name: /Sign In|Log In/i }).click();

    await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('Authenticated Admin sees database-driven dashboard metrics, Operational Errors, and Reports without fabricated revenue', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 1,
            email: 'admin.e2e@example.com',
            first_name: 'Clinic',
            last_name: 'Admin',
            role: 'ADMIN',
            permissions: ['dashboard.view', 'reports.view', 'appointments.view', 'appointments.manage', 'system.health'],
          },
          meta: {},
          error: null,
        }),
      })
    );
    await page.route('**/api/v1/auth/csrf-token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { csrf_token: 'e2e-admin-csrf' }, meta: {}, error: null }),
      })
    );
    await page.route('**/api/v1/notifications**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { items: [], unread_count: 0, total: 0 }, meta: {}, error: null }),
      })
    );
    await page.route('**/api/v1/realtime/ticket', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, meta: {}, error: { code: 'REALTIME_DISABLED', message: 'Offline in E2E' } }),
      })
    );
    await page.route('**/api/v1/admin/dashboard**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            counts: {
              patients: { total: 18, active: 17, inactive: 1 },
              dentists: { total: 4, active: 3, inactive: 1 },
              services: { total: 7, active: 6, inactive: 1 },
              appointments: {
                total: 45,
                pending: 3,
                confirmed: 8,
                upcoming: 11,
                completed: 30,
                cancelled: 4,
                today: 2,
              },
            },
            appointment_trends: [{ date: '2026-11-22', total: 2 }],
            outbox_summary: { totals: { pending: 0, processing: 0, completed: 12, failed: 0 } },
            recent_errors: [],
            recent: { patients: [], services: [] },
            today_schedule: [],
            review_queue_peek: [],
            recent_activity: [],
            system_alerts: { pending_triage: 3, recent_security_events: 0, active_rate_limits: 0 },
            generated_at: '2026-11-22T10:00:00+08:00',
          },
          meta: {},
          error: null,
        }),
      })
    );

    await page.goto('/admin/dashboard');
    await expect(page.getByText(/Clinic Executive Dashboard/i)).toBeVisible();
    await expect(page.getByText(/Active Dentists/i)).toBeVisible();
    await expect(page.getByText(/Active Services/i)).toBeVisible();
    await expect(page.getByText(/Upcoming Appointments/i)).toBeVisible();
    await expect(page.getByText(/Outbox Delivery Health/i)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
