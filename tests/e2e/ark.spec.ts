import { expect, test, type Page } from '@playwright/test';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, zooCard, projectById, PROJECT_REWARD_NAMES, type ArkSession } from '@eurogame/game-ark-nova';
import { arkSubmit, preparedArk, naturalCheckpoint, specialHallCheckpoint } from './ark-checkpoints.js';

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
  await expect(page.getByRole('heading', { name: '方舟动物园 · 双人地图 A / 0', exact: true })).toBeVisible();
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

test('阶段三验收：创建地图 0、边界首建、随机奖励与分槽恢复', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /方舟动物园/ }).click();
  await page.getByLabel('动物园地图', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true }).click();
  await expect(page.getByRole('group', { name: '你的动物园 地图 0', exact: true }).getByRole('button')).toHaveCount(58);
  await expect(page.getByRole('region', { name: '本局随机保护奖励' }).locator('span > b')).toHaveCount(4);
  await chooseStartingHand(page);
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByLabel('建筑类型', { exact: true }).selectOption('enclosure-1');
  await page.getByRole('button', { name: '地图 0 格 4,1 空地', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: '边界' })).toBeVisible();
  await page.getByRole('button', { name: '地图 0 格 0,2 空地', exact: true }).click();
  await page.getByRole('button', { name: '确认建造', exact: true }).click();
  await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
  await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: '你的动物园 地图 0', exact: true })).toBeVisible();
  await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
});

test('阶段三验收：正常对局建成特殊馆后转移，刷新保留一次性选择', async ({ page }) => {
  test.setTimeout(60_000);
  const checkpoint = specialHallCheckpoint();
  await importGame(page, checkpoint.session);
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByLabel('建筑类型', { exact: true }).selectOption(checkpoint.build.kind);
  for (let index = 0; index < checkpoint.build.rotation; index += 1) await page.getByRole('button', { name: '↻ 旋转', exact: true }).click();
  if (checkpoint.build.flip) await page.getByRole('button', { name: '⇆ 镜像', exact: true }).click();
  await page.getByRole('button', { name: `地图 A 格 ${checkpoint.build.q},${checkpoint.build.r} 空地`, exact: true }).click();
  await page.getByRole('button', { name: '确认建造', exact: true }).click();
  for (let count = 0; count < 6; count += 1) {
    const prompt = await page.getByTestId('ark-choice-prompt').textContent();
    if (prompt?.includes('仅此一次')) break;
    await page.locator('.ark-choice-options button').first().click();
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
  }
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('仅此一次');
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('仅此一次');
  await page.locator('.ark-choice-option').filter({ hasText: `转移${zooCard(checkpoint.animal).name}` }).first().click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  if (await page.getByTestId('ark-choice-prompt').isVisible()) await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
});

test('阶段三验收：从真实正常局打出放归项目、选择奖励并公开占用等级', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => !current.state.pending && current.state.activePlayer === 'p1' && current.state.context?.action === 'association' &&
    arkGame.getDecision(current.state, 'p1')!.options.some(option => option.command.type === 'association' && option.command.releaseAnimal && option.command.reward === 'money-12'));
  const selected = arkGame.getDecision(session.state, 'p1')!.options.find(option => option.command.type === 'association' && option.command.releaseAnimal && option.command.reward === 'money-12')!;
  if (selected.command.type !== 'association') throw new Error('项目检查点错误。');
  const command = selected.command;
  await importGame(page, session);
  const button = page.locator('.ark-association-options button').filter({ hasText: projectById(command.target).name })
    .filter({ hasText: `放归${zooCard(command.releaseAnimal!).name}` }).filter({ hasText: PROJECT_REWARD_NAMES[command.reward]! });
  await button.first().click();
  for (let count = 0; count < 6 && await page.getByTestId('ark-choice-prompt').isVisible(); count += 1) {
    await page.locator('.ark-choice-options button').first().click();
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
  }
  await expect(page.getByTestId('ark-active-projects')).toContainText(projectById(command.target).name);
  await expect(page.getByTestId('ark-active-projects')).toContainText('你已支持');
});
