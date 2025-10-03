import { test, expect } from '@playwright/test';

test.describe('Social App', () => {
  test('loads homepage', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Bluesky/);
  });

  test('shows sign in button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    const signInButton = page.getByRole('button', { name: 'Sign in' });
    await expect(signInButton).toBeVisible();
  });

  test('can navigate to sign in page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const helloWorld = page.getByText('Hello world!').first();
    await expect(helloWorld).toBeVisible();
  });
});
