import { expect, test, type Page } from '@playwright/test';
import { applyCommand, createSession, exportArchive } from '@eurogame/engine-core';
import { demoGame, currentActor } from '@eurogame/game-demo';
import { instanceIds } from '@eurogame/content';

async function startMatch(page: Page, playerCount = 2) {
  await page.getByLabel('对局人数', { exact: true }).selectOption(String(playerCount));
  await page.getByRole('button', { name: '创建对局 · 与 AI 开始', exact: true }).click();
  await expect(page.getByRole('heading', { name: '林间研究员 · 你', exact: true })).toBeVisible();
}

async function choiceScenario(page: Page) {
  await page.getByLabel('起始场景').selectOption('choice');
  await page.getByRole('button', { name: '新建实验对局', exact: true }).click();
  await page.getByTestId('hand').getByRole('button', { name: '查看 种子图书馆', exact: true }).first().click();
  await page.getByRole('button', { name: '确认建设', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '好想法，从一局开始。', exact: true })).toBeVisible();
});

test('统一入口：匹配尚未开放，方舟限定双人，Demo 支持选择人数', async ({ page }) => {
  await expect(page.getByRole('radio', { name: /在线匹配/ })).toBeDisabled();
  await page.getByRole('button', { name: /方舟动物园/ }).click();
  await expect(page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true })).toBeEnabled();
  await expect(page.getByLabel('对局人数', { exact: true }).locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: /植序工坊/ }).click();
  await startMatch(page, 4);
  await expect(page.getByRole('region', { name: 'AI 对手' }).getByText('· AI')).toHaveCount(3);
});

test('规则页面解释行动、轮次、收入和胜负条件，并可直接开局', async ({ page }) => {
  await page.locator('nav a[href="#/rules"]').click();
  await expect(page.getByRole('heading', { name: '植序工坊 · 游戏规则', exact: true })).toBeVisible();
  for (const name of ['经营', '研究', '建设一张卡牌', '第 6 轮结束，得分最高者获胜']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: '创建一局试试', exact: true }).click();
  await startMatch(page);
  await page.getByRole('link', { name: '如何游玩 ↗', exact: true }).click();
  await page.getByRole('link', { name: '返回当前对局', exact: true }).click();
  await expect(page.getByTestId('revision')).toHaveText('0');
});

test('三人 AI 自动行动，玩家无需换屏且始终保留自己的手牌', async ({ page }) => {
  await startMatch(page, 3);
  const startingHand = await page.getByTestId('hand').getByRole('button').allTextContents();
  await page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true }).click();
  await expect(page.getByTestId('turn-status')).toContainText('正在思考');
  await expect(page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true })).toBeDisabled();
  await expect(page.getByTestId('turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByTestId('round')).toContainText('2');
  expect(await page.getByTestId('hand').getByRole('button').allTextContents()).toEqual(startingHand);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('人类与 AI 从正常设置连续完成六轮对局', async ({ page }) => {
  await startMatch(page);
  for (let round = 1; round <= 6; round += 1) {
    await expect(page.getByTestId('turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
    await expect(page.getByTestId('round')).toContainText(String(round));
    await page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true }).click();
  }
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('turn-status')).toHaveText('对局已结束');
  await expect(page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true })).toBeDisabled();
});

test('付费后的两次选择可以刷新恢复且不重复扣费', async ({ page }) => {
  await startMatch(page);
  await choiceScenario(page);
  await expect(page.getByTestId('choice-prompt')).toHaveText('选择研究方向');
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('choice-prompt')).toHaveText('选择研究方向');
  await page.getByRole('button', { name: '培育种子：能量 +2', exact: true }).click();
  await expect(page.getByTestId('choice-prompt')).toHaveText('选择研究收获');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '↧ 导出对局', exact: true }).click();
  const downloaded = await downloadEvent;
  const stream = await downloaded.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const archive = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(archive.snapshot.players[0].resources.credits).toBe(3);
  expect(archive.snapshot.resolution.pending.prompt).toBe('选择研究收获');
  await page.getByRole('button', { name: '发表成果：得分 +2', exact: true }).click();
  await expect(page.getByTestId('turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('离开牌桌暂停 AI，刷新继续和历史回放不会重复执行', async ({ page }) => {
  await startMatch(page);
  await page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true }).click();
  await page.locator('nav a[href="#/rules"]').click();
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await page.locator('nav a[href="#/lobby"]').click();
  await expect(page.getByRole('link', { name: '继续对局', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '继续对局', exact: true }).click();
  await expect(page.getByTestId('revision')).toHaveText('1');
  await page.getByLabel('回放修订', { exact: true }).focus();
  await page.getByLabel('回放修订', { exact: true }).press('Home');
  await expect(page.getByTestId('revision')).toHaveText('0');
  await page.getByRole('link', { name: '如何游玩 ↗', exact: true }).click();
  await page.getByRole('link', { name: '返回当前对局', exact: true }).click();
  await expect(page.getByTestId('revision')).toHaveText('0');
  await page.getByRole('button', { name: '返回当前对局', exact: true }).click();
  await expect(page.getByTestId('turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByTestId('round')).toContainText('2');
});

test('导入 AI 连续选择存档后自动完成，玩家不会看到 AI 私密选项', async ({ page }) => {
  const card = 'seed-library:1';
  const rest = instanceIds.filter(id => id !== card);
  let session = createSession(demoGame, { debug: true, deckOrder: [...rest.slice(0, 3), card, ...rest.slice(3)] }, 42);
  for (const command of [{ type: 'work' }, { type: 'play', instanceId: card, source: 'hand' }]) {
    const outcome = applyCommand(demoGame, session, { id: `fixture-${session.state.revision}`, actor: currentActor(session.state), revision: session.state.revision, command });
    if (!outcome.ok) throw new Error(outcome.error.message);
    session = outcome.session;
  }
  await page.getByLabel('导入对局文件').setInputFiles({
    name: 'ai-choice.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(session))
  });
  await expect(page.getByTestId('turn-status')).toContainText('正在思考');
  await expect(page.getByTestId('choice-prompt')).toHaveCount(0);
  await expect(page.getByTestId('turn-status')).toHaveText('轮到你行动', { timeout: 15_000 });
  await expect(page.getByTestId('revision')).toHaveText('4');
});

test('非法存档导入保留现有对局', async ({ page }) => {
  await startMatch(page);
  await page.getByLabel('导入对局文件').setInputFiles({
    name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"formatVersion":999}')
  });
  await expect(page.getByRole('alert')).toContainText('当前对局保持不变');
  await expect(page.getByTestId('revision')).toHaveText('0');
});

test('AI 自动完成最后一个回合并展示结果，终局回放只读', async ({ page }) => {
  await startMatch(page);
  await page.getByLabel('起始场景').selectOption('endgame');
  await page.getByRole('button', { name: '新建实验对局', exact: true }).click();
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 15_000 });
  const finalRevision = await page.getByTestId('revision').textContent();
  await page.getByLabel('回放修订', { exact: true }).focus();
  await page.getByLabel('回放修订', { exact: true }).press('Home');
  await expect(page.getByTestId('revision')).toHaveText('0');
  await expect(page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '返回当前对局', exact: true }).click();
  await expect(page.getByTestId('revision')).toHaveText(finalRevision!);
});

test('建造预览、旋转、扣费和撤销', async ({ page }) => {
  await page.locator('nav a[href="#/layout"]').click();
  await expect(page.getByText('自制演示地图', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '↻ 旋转 60°', exact: true }).click();
  await page.getByRole('button', { name: '⇆ 镜像', exact: true }).click();
  await page.getByLabel('地图格 0,0', { exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '边界' })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认建造 · 6 ◈', exact: true })).toBeDisabled();
  await page.getByLabel('建筑面积').selectOption('small');
  await expect(page.getByRole('status').filter({ hasText: '重叠' })).toBeVisible();
  await page.getByLabel('地图格 1,0', { exact: true }).click();
  await page.getByRole('button', { name: '确认建造 · 2 ◈', exact: true }).click();
  await expect(page.getByText('可用资金 23 ◈', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销上一次建造', exact: true }).click();
  await expect(page.getByText('可用资金 25 ◈', { exact: true })).toBeVisible();
});

test('工程进度与本地参考资料保持独立', async ({ page }) => {
  await page.locator('nav a[href="#/coverage"]').click();
  await expect(page.getByText('基础 235 张内容均已接入', { exact: false })).toBeVisible();
  await page.locator('nav a[href="#/catalog"]').click();
  await page.getByLabel('导入参考资料文件').setInputFiles({
    name: 'reference.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      formatVersion: 1,
      source: { repository: 'https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards', commit: 'test-reference', license: 'test-only', files: [] },
      cards: [{ id: 'test-401', name: 'Test reference only', category: 'animal', raw: {}, implementation: 'unimplemented' }], locales: {}
    }))
  });
  await expect(page.getByRole('heading', { name: '已载入 1 张参考卡牌' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '加载你的本地参考资料' })).toBeVisible();
});

test('构建后的网页无运行时错误且桌面没有横向溢出', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await startMatch(page);
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByTestId('market').getByRole('button')).toHaveCount(4);
  expect(errors).toEqual([]);
});
