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

async function login(page: import('@playwright/test').Page, email: string, home: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(home);
}

for (const account of accounts) {
  test(`${account.label} logs in and lands on the dashboard`, async ({ page }) => {
    await login(page, account.email, account.home);

    await expect(page).toHaveURL(account.home);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(account.heading);
  });
}

test('guards redirect anonymous and wrong-role deep links', async ({ page }) => {
  await page.goto('/app/student');
  await expect(page).toHaveURL(/\/login$/);

  await login(page, 'student@stagelink.demo', '/app/student');
  await page.goto('/app/platform');
  await expect(page).toHaveURL('/app/student');
  await page.goto('/login');
  await expect(page).toHaveURL('/app/student');
});

test('logout clears the session and returns to login', async ({ page }) => {
  await login(page, 'student@stagelink.demo', '/app/student');

  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app/student');
  await expect(page).toHaveURL(/\/login$/);
});

test('profile loads and the password modal opens and closes', async ({ page }) => {
  await login(page, 'student@stagelink.demo', '/app/student');
  await page.goto('/app/student/profile');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Profile');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('dialog')).toContainText('Change password');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [1280, 1920]) {
  test(`dashboards do not overflow horizontally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const account of accounts) {
      await login(page, account.email, account.home);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${account.label} dashboard overflows at ${width}px`).toBe(false);
      await page.evaluate(() => localStorage.clear());
      await page.goto('/login');
    }
  });
}
