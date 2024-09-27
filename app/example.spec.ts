import { test, expect } from '@playwright/test';

test('有百度一下标题', async ({ page }) => {
  await page.goto('https://www.baidu.com/');
  sys.set('a', 1234);
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/百度一下/);
  sys.setEnvVariable('b', 4567);
});

test.afterAll(() => {
  const fs = require('fs');
  const fileName = __filename
    .replaceAll(__dirname, '')
    .replaceAll('.spec.ts', '')
    .replaceAll('/', '')
    .replaceAll('\\', '')
    .replaceAll('.', '');
  fs.writeFileSync('scripts/' + fileName + '.states.json', JSON.stringify(sys.states()), 'utf8');
});
