import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://www.baidu.com/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/百度一下/);
});
