import { expect, test, type Page } from '@playwright/test';
import { exportArchive } from '@eurogame/engine-core';
import { buildCommands, type ArkSession } from '@eurogame/game-ark-nova';
import { arkSubmit, preparedArk } from './ark-checkpoints.js';

async function load(page: Page, session: ArkSession) {
  await page.goto('./');
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'console.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(session)) });
  await expect(page.getByTestId('ark-console')).toBeVisible();
}
for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`操作台：${viewport.width} 地图优先，操作按钮在底部，面板可收起`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await load(page, preparedArk(42));
    const console = (await page.getByTestId('ark-console').boundingBox())!;
    const map = (await page.locator('.ark-map').boundingBox())!;
    expect(map.height).toBeGreaterThan(viewport.height * .4);
    expect(map.y + map.height).toBeLessThanOrEqual(console.y);
    const actions = (await page.getByTestId('ark-actions').boundingBox())!;
    expect(actions.y).toBeGreaterThan(console.y);
    await page.getByTestId('action-help-build').hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(page.getByTestId('ark-console').locator('select')).toHaveCount(0);
    const choices = page.getByRole('radiogroup', { name: '建筑类型', exact: true });
    await expect(choices.getByRole('radio')).toHaveCount(10);
    const confirm = (await page.getByRole('button', { name: '确认建造', exact: true }).boundingBox())!;
    expect(confirm.y).toBeGreaterThan(console.y);
    expect(confirm.y + confirm.height).toBeLessThanOrEqual(viewport.height);
    await page.getByRole('button', { name: '公共信息 / 目标 +', exact: true }).click();
    await expect(page.getByRole('region', { name: '公共信息', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '收起公共信息 −', exact: true }).click();
    await expect(page.getByRole('region', { name: '公共信息', exact: true })).toBeHidden();
    await page.getByRole('button', { name: '公共展示区 收起 −', exact: true }).click();
    await expect(page.getByTestId('ark-market')).toBeHidden();
    await page.getByRole('button', { name: '公共展示区 展开 +', exact: true }).click();
    await expect(page.getByTestId('ark-market')).toBeVisible();
    await page.getByRole('group', { name: '操作台卡牌来源', exact: true }).getByRole('button', { name: /展示区/ }).click();
    await expect(page.getByTestId('ark-hand').locator('.ark-card')).toHaveCount(6);
    await page.getByRole('group', { name: '操作台卡牌来源', exact: true }).getByRole('button', { name: /手牌/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);
  });
}

test('操作台：观察对手园区不修改自己的建造草稿，返回可继续确认', async ({ page }) => {
  let session = preparedArk(42);
  session = arkSubmit(session, { type: 'begin', action: 'build', spendX: 0 });
  const build = buildCommands(session.state, session.state.players[0]!, session.state.context!.remaining, false, [], Infinity).find(command => command.kind === 'enclosure-1')!;
  await load(page, session);
  await page.locator(`.ark-map [data-cell="${build.q},${build.r}"]`).click();
  const outline = await page.locator('.ark-placement-outline').getAttribute('d');
  await page.getByRole('button', { name: '观察 AI 园区', exact: true }).click();
  await expect(page.locator('.ark-map')).toHaveAttribute('aria-label', '林野动物园 AI 地图 A');
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeDisabled();
  await expect(page.locator('.ark-map polygon[role=button]').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('region', { name: '观察园区公开卡牌', exact: true })).toContainText('对手手牌与终局目标保持隐藏');
  await page.getByRole('button', { name: '返回我的园区', exact: true }).click();
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-placement-locked', 'true');
  await expect(page.locator('.ark-placement-outline')).toHaveAttribute('d', outline!);
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeEnabled();
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
});

test('操作台：协会合作目标通过大洲图标选择，最终确认前不执行', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  let session = preparedArk(42);
  session = arkSubmit(session, { type: 'begin', action: 'association', spendX: 0 });
  await load(page, session);
  const console = page.getByTestId('ark-console');
  await expect(console.locator('select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '确认协会任务', exact: true })).toBeDisabled();
  await page.getByTestId('action-help-build').hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.getByRole('radiogroup', { name: '协会任务', exact: true }).getByRole('radio', { name: '合作动物园', exact: true }).click();
  await page.getByRole('button', { name: '观察 AI 园区', exact: true }).click();
  await page.getByRole('button', { name: '返回我的园区', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: '任务目标', exact: true }).getByRole('radio')).toHaveCount(5);
  const surface = (await page.locator('.ark-control-scroll').boundingBox())!;
  for (const button of await page.getByRole('radiogroup', { name: '任务目标', exact: true }).getByRole('radio').all()) {
    const bounds = (await button.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(surface.y + surface.height);
  }
  await page.getByRole('radio', { name: '美洲合作动物园', exact: true }).click();
  await expect(page.locator('.ark-association-review')).toContainText('美洲合作动物园');
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
  await page.getByRole('button', { name: '确认协会任务', exact: true }).click();
  await expect(page.getByTestId('p1-tag-americas').locator('b')).toHaveText('1');
});
