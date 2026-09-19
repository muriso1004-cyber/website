const { test, expect } = require('@playwright/test');

const siteUrl = process.env.SITE_URL || 'https://website-muriso.vercel.app';

test('검색 버튼 클릭 시 결과 개수와 결과 영역을 갱신한다', async ({ page }) => {
  await page.goto(`${siteUrl}/#/search`);

  const filterButton = page.locator('#filterBtn');
  const resultCount = page.locator('#resultCount');
  const results = page.locator('#results');

  await expect(filterButton).toBeVisible();
  await resultCount.evaluate((element) => {
    element.textContent = '회귀 테스트 표식';
  });
  await results.evaluate((element) => {
    element.innerHTML = '<p data-regression-sentinel>회귀 테스트 표식</p>';
  });

  await filterButton.click();

  await expect(resultCount).toHaveText(/^조건에 맞는 매물 \d+건$/);
  await expect(results.locator('[data-regression-sentinel]')).toHaveCount(0);

  const count = Number((await resultCount.textContent()).match(/(\d+)건/)[1]);
  if (count === 0) {
    await expect(results).toContainText('조건에 맞는 매물이 없습니다.');
  } else {
    await expect(results.locator(':scope > *')).toHaveCount(count);
  }
});
