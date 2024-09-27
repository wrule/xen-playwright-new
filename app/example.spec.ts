import { test, expect } from '@playwright/test';

test('有百度一下标题', async ({ page }) => {
  await page.goto('https://www.baidu.com/');
  sys.set('a', 1234);
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/百度一下/);
  sys.setEnvVariable('b', 4567);
});
