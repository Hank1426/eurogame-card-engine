import { expect, test, type Page } from '@playwright/test';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, type ArkSession } from '@eurogame/game-ark-nova';
import { arkSubmit, preparedArk, naturalCheckpoint } from './ark-checkpoints.js';

async function importGame(page: Page, session: ArkSession) {
  await page.goto('./');
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'ark-checkpoint.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(session)) });
  await expect(page.getByTestId('ark-table')).toBeVisible();
}

async function launch(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /方舟动物园/ }).click();
  await page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true }).click();
  await expect(page.getByTestId('ark-choice-prompt')).toHaveText('从 8 张起始卡牌中保留 4 张');
}
async function chooseStartingHand(page: Page) {
  const cards = page.locator('.ark-choice-options .ark-card');
  for (let index = 0; index < 4; index += 1) await cards.nth(index).click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
}
test('阶段一验收：创建、起手选牌、地图、五行动、建造和自动保存', async ({ page }) => {
  await launch(page);
  await expect(page.locator('.ark-choice-options .ark-card')).toHaveCount(8);
  await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeDisabled();
  await expect(page.getByTestId('ark-actions').locator('article')).toHaveCount(5);
  await expect(page.getByRole('group', { name: '你的动物园 地图 A', exact: true }).getByRole('button')).toHaveCount(58);
  await chooseStartingHand(page);
  await expect(page.getByTestId('ark-market').locator('.ark-card')).toHaveCount(6);
  await expect(page.getByTestId('ark-hand').locator('.ark-card')).toHaveCount(4);
  await expect(page.getByTestId('ark-money')).toHaveText('25 ◈');
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByLabel('建筑类型', { exact: true }).selectOption('enclosure-1');
  await page.getByRole('button', { name: '↻ 旋转', exact: true }).click();
  await page.getByRole('button', { name: '⇆ 镜像', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '确认建造', exact: true }).click();
  await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
  await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
  await expect(page.getByTestId('ark-actions').locator('article').first()).toContainText('建造');
});

test('阶段一验收：规则入口和起手选择刷新恢复', async ({ page }) => {
  await launch(page);
  await page.locator('.ark-choice-options .ark-card').first().click();
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-choice-prompt')).toHaveText('从 8 张起始卡牌中保留 4 张');
  await expect(page.locator('.ark-choice-options .ark-card')).toHaveCount(8);
  await page.getByRole('link', { name: '游戏规则 ↗', exact: true }).click();
  await expect(page.getByRole('heading', { name: '方舟动物园 · 双人地图 A', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '返回方舟牌桌', exact: true }).click();
  await expect(page.getByTestId('ark-choice-prompt')).toBeVisible();
});

test('阶段二验收：真实起手与合法行动后安置耳廓狐，机灵选择可恢复且不重复扣费', async ({ page }) => {
  let seed = 0;
  while (!createSession(arkGame, {}, seed).state.players[0]!.hand.includes('405')) seed += 1;
  let session = preparedArk(seed, ['405']);
  session = arkSubmit(session, { type: 'take-x', action: 'animals' });
  while (arkActor(session.state) !== 'p1') {
    const actor = arkActor(session.state);
    session = arkSubmit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
  }
  await importGame(page, session);
  await page.getByLabel('使用 X 标记', { exact: true }).fill('1');
  await page.getByRole('button', { name: '选择动物行动', exact: true }).click();
  await page.getByTestId('ark-hand').getByRole('button', { name: '查看 耳廓狐', exact: true }).click();
  await page.getByRole('button', { name: '确认安置动物', exact: true }).click();
  await expect(page.getByTestId('ark-money')).toHaveText('17 ◈');
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('机灵');
  await expect(page.getByTestId('ark-actions').locator('article').first()).toContainText('动物');
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('机灵');
  await expect(page.getByTestId('ark-money')).toHaveText('17 ◈');
  await page.getByRole('button', { name: /建造 → 槽位 1/ }).click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByTestId('ark-actions').locator('article').first()).toContainText('建造');
});

test('阶段二验收：卡牌抓三弃一必须完整执行，手牌和市场正常补充', async ({ page }) => {
  let seed = 0;
  while (createSession(arkGame, {}, seed).state.players[0]!.row.indexOf('cards') !== 4) seed += 1;
  await importGame(page, preparedArk(seed));
  await page.getByRole('button', { name: '选择卡牌行动', exact: true }).click();
  await expect(page.getByRole('button', { name: '结束本次行动', exact: true })).toBeDisabled();
  for (let index = 0; index < 3; index += 1) await page.getByRole('button', { name: '从牌库抓 1 张', exact: true }).click();
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('卡牌行动表：弃除 1');
  await expect(page.locator('.ark-choice-options .ark-card')).toHaveCount(7);
  await page.locator('.ark-choice-options .ark-card').first().click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByTestId('ark-hand').locator('.ark-card')).toHaveCount(6);
  await expect(page.getByTestId('ark-market').locator('.ark-card')).toHaveCount(6);
});

test('阶段二验收：正常整局的最后回合通过界面完成，终局与回放一致', async ({ page }) => {
  const session = naturalCheckpoint(current => current.state.finalTurns === 1 && current.state.stage === 'turn' && !current.state.pending && current.state.activePlayer === 'p1');
  await importGame(page, session);
  await page.getByRole('button', { name: '选择赞助商行动', exact: true }).click();
  await page.getByRole('button', { name: /休息 \+\d+ · 领取 \d+ 资金/ }).click();
  while (await page.getByRole('button', { name: '确认选择', exact: true }).isVisible()) {
    const options = page.locator('.ark-choice-options .ark-choice-option');
    if (await options.count()) await options.first().click();
    else await page.locator('.ark-choice-options .ark-card').first().click();
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
  }
  await expect(page.getByTestId('ark-result')).toBeVisible({ timeout: 15_000 });
  const revision = await page.getByTestId('ark-revision').textContent();
  await page.locator('.ark-log summary').click();
  await page.getByLabel('回放修订', { exact: true }).focus();
  await page.getByLabel('回放修订', { exact: true }).press('Home');
  await expect(page.getByTestId('ark-revision')).toHaveText('0');
  await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '返回当前对局', exact: true }).click();
  await expect(page.getByTestId('ark-revision')).toHaveText(revision!);
  await expect(page.getByTestId('ark-result')).toBeVisible();
});
