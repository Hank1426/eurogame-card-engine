import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { BUILTIN_CATALOG } from '../../apps/web/asset-catalog.js';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, zooCard, projectById, ACTION_NAMES, type ArkSession } from '@eurogame/game-ark-nova';
import { arkSubmit, preparedArk, naturalCheckpoint, specialHallCheckpoint, terrainCheckpoint } from './ark-checkpoints.js';

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
  await chooseStartingHand(page);
  await expect(page.getByRole('group', { name: '你的动物园 地图 A', exact: true }).getByRole('button')).toHaveCount(58);
  await expect(page.getByTestId('ark-market').locator('.ark-card')).toHaveCount(6);
  await expect(page.getByTestId('ark-hand').locator('.ark-card')).toHaveCount(4);
  await expect(page.getByTestId('ark-money')).toHaveText('25 ◈');
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByRole('radiogroup', { name: '建筑类型', exact: true }).locator('[data-value="enclosure-1"]').click();
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
  await expect(page.getByRole('heading', { name: '方舟动物园 · 双人地图 A / 0 / 1 / 2', exact: true })).toBeVisible();
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
  // Includes searching several complete games before exercising the browser.
  test.setTimeout(60_000);
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
  await page.getByRole('button', { name: '日志与回放', exact: true }).click();
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
  await chooseStartingHand(page);
  await expect(page.getByRole('group', { name: '你的动物园 地图 0', exact: true }).getByRole('button')).toHaveCount(58);
  await page.getByRole('button', { name: '公共信息 / 目标 +', exact: true }).click();
  await expect(page.getByRole('region', { name: '本局随机保护奖励' }).locator('span > b')).toHaveCount(4);
  await page.getByRole('button', { name: '收起公共信息 −', exact: true }).click();
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByRole('radiogroup', { name: '建筑类型', exact: true }).locator('[data-value="enclosure-1"]').click();
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
  if (checkpoint.spendX) await page.getByLabel('使用 X 标记', { exact: true }).fill(String(checkpoint.spendX));
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByRole('radiogroup', { name: '建筑类型', exact: true }).locator(`[data-value="${checkpoint.build.kind}"]`).click();
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
  await page.getByRole('radiogroup', { name: '协会任务', exact: true }).getByRole('radio', { name: '支持保护项目', exact: true }).click();
  await page.getByRole('radiogroup', { name: '任务目标', exact: true }).locator(`[data-value="${command.source ?? 'board'}:${command.target}"]`).click();
  await page.getByRole('radiogroup', { name: '支持等级', exact: true }).locator(`[data-value="${command.tier}"]`).click();
  await page.getByRole('radiogroup', { name: '放归动物', exact: true }).locator(`[data-value="${command.releaseAnimal}"]`).click();
  await page.getByRole('radiogroup', { name: '边缘奖励', exact: true }).locator(`[data-value="${command.reward}"]`).click();
  await page.getByRole('button', { name: '确认协会任务', exact: true }).click();
  for (let count = 0; count < 6 && await page.getByTestId('ark-choice-prompt').isVisible(); count += 1) {
    await page.locator('.ark-choice-options button').first().click();
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
  }
  await page.getByRole('button', { name: '公共信息 / 目标 +', exact: true }).click();
  await expect(page.getByTestId('ark-active-projects')).toContainText(projectById(command.target).name);
  await expect(page.getByTestId('ark-active-projects')).toContainText('你已支持');
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`牌桌验收：${viewport.width}×${viewport.height} 地图、手牌、五行动和确认同屏`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await importGame(page, preparedArk(42));
    for (const selector of ['.ark-map', '[data-testid=ark-market]', '[data-testid=ark-hand]', '[data-testid=ark-actions]', '[data-testid=ark-confirm-area]']) {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      expect(box!.y, selector).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, selector).toBeLessThanOrEqual(viewport.height);
      expect(box!.x + box!.width, selector).toBeLessThanOrEqual(viewport.width);
    }
    await page.getByTestId('ark-hand').locator('.ark-card').first().click();
    await expect(page.locator('.ark-detail h2')).toBeVisible();
    await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeInViewport();
    await expect(page.getByTestId('ark-actions')).toBeInViewport();
    expect(await page.evaluate(() => ({ top: window.scrollY, scroll: document.documentElement.scrollHeight, height: window.innerHeight }))).toEqual({ top: 0, scroll: viewport.height, height: viewport.height });
  });
}

test('地形验收：截图五格区只高亮水域，合法五格区同时满足水与岩石', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const valid of [false, true]) {
    await importGame(page, terrainCheckpoint(valid));
    await page.getByTestId('ark-hand').getByRole('button', { name: '查看 新澳海狗', exact: true }).click();
    await page.getByRole('button', { name: '地图 A 格 2,3 5 格饲养区', exact: true }).click();
    const rocks = page.locator('.ark-detail .ark-condition').filter({ has: page.getByRole('img', { name: '岩石', exact: true }) });
    await expect(rocks).toHaveClass(valid ? /(?:^| )met(?: |$)/ : /(?:^| )unmet(?: |$)/);
    await expect(rocks).toContainText(valid ? '1/1' : '0/1');
    await expect(page.locator('.ark-map .rock.adjacent-terrain')).toHaveCount(valid ? 1 : 0);
    await expect(page.locator('.ark-map .water.adjacent-terrain')).toHaveCount(valid ? 1 : 2);
    await expect(page.locator('.ark-map .amenity-label')).toContainText('贩售亭');
    await expect(page.getByRole('button', { name: '开始动物行动', exact: true })).toBeDisabled();
    await expect(page.locator('.ark-confirm-area .validation')).toContainText('动物行动 II');
    await expect(page.locator('.ark-confirm-area .validation')).toBeInViewport();
  }
});

test('素材验收：保护项目图集可载入，缺少参考目录时仍有可辨识插画与建筑', async ({ page, request }) => {
  const response = await request.get('/__ark_reference__/manifest.json');
  const manifest = response.ok() ? await response.json() as Record<string, string> : {};
  if (manifest.projectAtlas) {
    expect((await request.get(manifest.projectAtlas)).status()).toBe(200);
    await importGame(page, preparedArk(42));
    await page.getByRole('button', { name: '公共信息 / 目标 +', exact: true }).click();
    const image = page.locator('.ark-project-art .ark-art-sprite').first();
    await expect(image).toBeVisible();
    await expect(page.locator('.ark-project-art .ark-artwork').first()).toHaveAttribute('data-asset-status', 'ready');
    await expect(page.locator('.ark-icon-sprite img, .ark-art-sprite img')).toHaveCount(0);
  }
  for (const path of ['/__ark_reference__/%2e%2e%2fpackage.json', '/__ark_reference__/%ZZ', '/__ark_reference__/maps/plan0.jpg']) {
    expect((await request.get(path)).status()).toBe(404);
  }
  await page.route('**/__ark_reference__/catalog.json*', route => route.fulfill({ json: BUILTIN_CATALOG }));
  await importGame(page, preparedArk(42));
  if (await page.getByRole('button', { name: '公共信息 / 目标 +', exact: true }).isVisible()) await page.getByRole('button', { name: '公共信息 / 目标 +', exact: true }).click();
  await expect(page.locator('.ark-project-art .ark-art-fallback').first()).toBeVisible();
  await expect(page.locator('.ark-map .amenity-label')).toContainText('贩售亭');
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeEnabled();
});

for (const map of ['1', '2'] as const) {
  test(`阶段四验收：地图 ${map} 特性、首座建筑和刷新恢复`, async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /方舟动物园/ }).click();
    await page.getByLabel('动物园地图', { exact: true }).selectOption(map);
    await expect(page.getByTestId('ark-map-description')).toContainText(map === '1' ? '观测塔' : '户外营地');
    await page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true }).click();
    await chooseStartingHand(page);
    await expect(page.getByRole('group', { name: `你的动物园 地图 ${map}`, exact: true }).getByRole('button')).toHaveCount(58);
    await expect(page.locator('.ark-map .landmark')).toHaveCount(1);
    await expect(page.getByTestId('ark-map-ability')).toContainText(map === '1' ? '2 魅力' : '容量 +2');
    await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
    const coordinate = map === '1' ? '0,0' : '0,2';
    await page.getByRole('button', { name: `地图 ${map} 格 ${coordinate} 空地`, exact: true }).click();
    await page.getByRole('button', { name: '确认建造', exact: true }).click();
    await expect(page.getByTestId('ark-turn-status')).toHaveText('轮到你行动', { timeout: 20_000 });
    await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
    await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('ark-map-ability')).toBeVisible();
    await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
    await expect(page.getByTestId('ark-actions')).toBeInViewport();
  });
}

test('阶段四验收：正常局挖掘逐次选择，刷新不重复支付动物费用', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && /挖掘.*[2-4] 次/.test(current.state.pending.prompt) && current.state.pending.options.some(option => option.id.startsWith('dig-hand-')));
  const money = session.state.players[0]!.money;
  await importGame(page, session);
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('挖掘');
  await expect(page.getByTestId('ark-money')).toHaveText(`${money} ◈`);
  const option = session.state.pending!.options.find(option => option.id.startsWith('dig-hand-'))!;
  const selected = page.locator('.ark-choice-card').filter({ hasText: option.label });
  await selected.getByRole('button').click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  const revision = await page.getByTestId('ark-revision').textContent();
  await page.reload();
  await expect(page.getByTestId('ark-revision')).toHaveText(revision!);
  await expect(page.getByTestId('ark-money')).toHaveText(`${money} ◈`);
  if (await page.getByTestId('ark-choice-prompt').isVisible()) {
    await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
  }
});

test('阶段四验收：正常局调度在动物行动归位后将指定卡移到槽位五', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && current.state.pending.prompt.includes('调度'));
  const option = session.state.pending!.options.find(option => option.label.endsWith('槽位 5'))!;
  const effect = option.effects.find(item => item.effect.type === 'boost-action')!.effect;
  if (effect.type !== 'boost-action') throw new Error('调度场景不正确。');
  await importGame(page, session);
  await expect(page.getByTestId('ark-actions').locator('article').first()).toContainText('动物');
  await page.getByRole('button', { name: new RegExp(option.label) }).click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await expect(page.getByTestId('ark-actions').locator('article').last()).toContainText(ACTION_NAMES[effect.action]);
});

test('阶段四验收：多个赞助商效果的结算顺序可恢复，选择后只提交一次', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && current.state.pending.prompt.includes('多个效果'), [5]);
  await importGame(page, session);
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('多个效果');
  const money = await page.getByTestId('ark-money').textContent();
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-money')).toHaveText(money!);
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('多个效果');
  await page.locator('.ark-choice-options .ark-choice-option').first().click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '↧ 导出对局', exact: true }).click();
  const downloadPath = await (await downloadEvent).path();
  if (!downloadPath) throw new Error('导出文件不可用。');
  const saved = JSON.parse(await readFile(downloadPath, 'utf8')) as { commands: { command: { type: string; choiceId?: string } }[] };
  expect(saved.commands.filter(command => command.command.type === 'resolve' && command.command.choiceId === session.state.pending!.id)).toHaveLength(1);
});
