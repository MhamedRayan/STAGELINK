import { expect, test } from '@playwright/test';

/** Login → role dashboard for every seeded account. Run against a seeded stack. */
const accounts = [
  { label: 'platform admin', email: 'admin@stagelink.demo', home: '/app/platform', heading: 'Dashboard' },
  { label: 'university admin', email: 'university@stagelink.demo', home: '/app/university', heading: 'University Administration' },
  { label: 'supervisor', email: 'supervisor@stagelink.demo', home: '/app/supervisor', heading: 'Supervisor Dashboard' },
  { label: 'company', email: 'company@stagelink.demo', home: '/app/company', heading: 'Company Dashboard' },
  { label: 'student', email: 'student@stagelink.demo', home: '/app/student', heading: 'Welcome back,' },
] as const;

const password = process.env.DEMO_PASSWORD ?? 'StagelinkDemo!2026';

for (const account of accounts) {
  test(`${account.label} logs in and lands on the dashboard`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(account.home);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(account.heading);
  });
}
