import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, breakIncome, tagsOf, projectById, FINAL_CARDS, buildCommands, zooCard, type ArkSession } from '@eurogame/game-ark-nova';
import { preparedArk, arkSubmit, naturalCheckpoint } from './ark-checkpoints.js';
import { BUILTIN_CATALOG } from '../../apps/web/asset-catalog.js';

async function importGame(page: Page, session: ArkSession) {
  await page.goto('./');
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'experience.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(session)) });
  await expect(page.getByTestId('ark-table')).toBeVisible();
}
async function archive(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: '↧ 导出对局', exact: true }).click();
  const path = await (await waiting).path();
  if (!path) throw new Error('导出失败。');
  return JSON.parse(await readFile(path, 'utf8')) as { commands: { actor: string; command: { type: string; choiceId?: string; options?: string[] } }[] };
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`信息：${viewport.width} 桌面留牌时公共动保、秘密目标和双方摘要同屏`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const session = createSession(arkGame, {}, 42);
    await importGame(page, session);
    const goals = page.getByTestId('ark-opening-goals');
    for (const project of session.state.projects) {
      const card = projectById(project.id);
      await expect(goals.getByRole('article', { name: card.name, exact: true })).toBeVisible();
    }
    for (const id of session.state.players[0]!.finals) await expect(goals.getByText(FINAL_CARDS.find(card => card.id === id)!.name, { exact: true })).toBeVisible();
    await expect(goals.locator('.blocked')).toHaveCount(3);
    await expect(page.locator('.starting-hand .ark-card')).toHaveCount(8);
    const surface = (await page.getByRole('region', { name: '起手选牌', exact: true }).boundingBox())!;
    for (const candidate of await page.locator('.starting-hand .ark-card').all()) {
      const bounds = (await candidate.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(surface.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(surface.y + surface.height);
    }
    const revision = await page.getByTestId('ark-revision').innerText();
    await goals.locator('.ark-opening-final').first().hover();
    await expect(page.getByRole('tooltip')).toContainText('10 保护点');
    expect(await page.getByTestId('ark-revision').innerText()).toBe(revision);
    await page.keyboard.press('Escape');
    for (let index = 0; index < 4; index += 1) await page.locator('.starting-hand .ark-card').nth(index).click();
    const elements = [goals, page.getByTestId('ark-player-p1'), page.getByTestId('ark-player-p2'), page.getByRole('button', { name: '确认选择', exact: true }), page.locator('.starting-hand .ark-card').last()];
    for (const element of elements) {
      const bounds = await element.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
    await expect(goals).toHaveCount(0);
    await expect(page.getByTestId('ark-market')).toBeVisible();
    await expect(page.getByTestId('ark-player-p2')).toBeVisible();
  });
}

test('信息：双方全部公开图标与收入持续可见，悬停来源准确且不改变对局', async ({ page }) => {
  const session = naturalCheckpoint(current => current.state.turns >= 25 && current.state.stage === 'turn' && current.state.activePlayer === 'p1' && current.state.players[0]!.animals.length > 0);
  await importGame(page, session);
  const view = arkGame.getPlayerView(session.state, 'p1');
  for (const player of view.players) {
    const summary = page.getByTestId(`ark-player-${player.id}`);
    await expect(summary.locator('.ark-tag-count')).toHaveCount(15);
    await expect(page.getByTestId(`${player.id}-income`).locator('b')).toHaveText(String(breakIncome(player).money));
    for (const [tag, count] of Object.entries(tagsOf(player))) await expect(page.getByTestId(`${player.id}-tag-${tag}`).locator('b')).toHaveText(String(count));
    await expect(summary.getByTestId(`${player.id}-appeal`).locator('b')).toHaveText(String(player.appeal));
    await expect(summary.getByTestId(`${player.id}-conservation`).locator('b')).toHaveText(String(player.conservation));
  }
  await page.getByTestId('p1-income').hover();
  await expect(page.getByRole('tooltip')).toContainText('魅力收入');
  await expect(page.getByRole('tooltip')).toContainText(`+${breakIncome(view.players[0]!).money}`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const tag = Object.entries(tagsOf(view.players[0]!)).find(([, count]) => count > 0)![0];
  await page.getByTestId(`p1-tag-${tag}`).focus();
  await expect(page.getByRole('tooltip')).toContainText('手牌不计入');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'AI 园区', exact: true }).click();
  await expect(page.getByTestId('ark-player-p1')).toBeVisible();
  await expect(page.getByTestId('ark-player-p2')).toBeVisible();
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
});

test('体验：鼠标与键盘快速放大卡牌，浮层不拦截正常选卡', async ({ page }) => {
  const session = preparedArk(42);
  await importGame(page, session);
  const card = page.getByTestId('ark-hand').locator('.ark-card').first();
  const name = zooCard(session.state.players[0]!.hand[0]!).name;
  await card.hover();
  await expect(page.getByRole('tooltip').getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
  await card.click();
  await expect(page.locator('.ark-detail h2')).toHaveText(name);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByTestId('ark-hand').locator('.ark-card').nth(1).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
});

test('体验：普通建造跟随预览、锁定、R/F/Esc，确认前不消耗资源', async ({ page }) => {
  let seed = 0;
  while (createSession(arkGame, {}, seed).state.players[0]!.row.indexOf('build') < 1) seed += 1;
  const session = preparedArk(seed);
  const begun = arkSubmit(session, { type: 'begin', action: 'build', spendX: 0 });
  const command = buildCommands(begun.state, begun.state.players[0]!, begun.state.context!.remaining, false, [], Infinity).find(command => command.kind === 'enclosure-2' && command.rotation === 0 && !command.flip)!;
  await importGame(page, session);
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByLabel('建筑类型', { exact: true }).selectOption('enclosure-2');
  const target = page.locator(`.ark-map [data-cell="${command.q},${command.r}"]`);
  await target.hover();
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-placement-locked', 'false');
  await expect(page.locator('.ark-placement-outline.valid')).toBeVisible();
  await expect(page.getByTestId('ark-money')).toHaveText('25 ◈');
  await expect(page.getByTestId('ark-revision')).toHaveText(String(begun.state.revision));
  await page.getByRole('heading', { name: /方舟动物园/ }).click();
  await page.keyboard.press('r');
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-preview-rotation', '1');
  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: '地图镜像建筑', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('f');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('r');
  await target.click();
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-placement-locked', 'true');
  const shape = await page.locator('.ark-placement-outline').getAttribute('d');
  await page.locator('.ark-map .water polygon[role=button]').first().hover();
  await expect(page.locator('.ark-placement-outline')).toHaveAttribute('d', shape!);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-placement-locked', 'false');
  await page.locator('.ark-map .water polygon[role=button]').first().hover();
  await expect(page.locator('.ark-placement-outline.invalid')).toBeVisible();
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeDisabled();
  await target.click();
  await page.getByRole('button', { name: '确认建造', exact: true }).click();
  await expect(page.getByTestId('ark-money')).toHaveText('21 ◈');
  const saved = await archive(page);
  expect(saved.commands.filter(entry => entry.actor === 'p1' && entry.command.type === 'build')).toHaveLength(1);
});

test('体验：建筑快捷键不会劫持建筑类型选择框', async ({ page }) => {
  await importGame(page, preparedArk(42));
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByLabel('建筑类型', { exact: true }).focus();
  await page.keyboard.press('r');
  await page.keyboard.press('f');
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-preview-rotation', '0');
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-preview-flip', 'false');
});

test('体验：免费奖励建筑直接点击地图，候选列表保持简短，确认只提交一次', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && current.state.pending.options.some(option => option.effects.some(item => item.effect.type === 'place-free-build')));
  const option = session.state.pending!.options.find(option => option.effects.some(item => item.effect.type === 'place-free-build'))!;
  const effect = option.effects.find(item => item.effect.type === 'place-free-build')!.effect;
  if (effect.type !== 'place-free-build') throw new Error('免费建筑场景不正确。');
  await importGame(page, session);
  await expect(page.getByRole('toolbar', { name: '建筑预览工具' })).toBeVisible();
  await expect(page.locator('.ark-choice-options .ark-choice-option')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeDisabled();
  const target = page.locator(`.ark-map [data-cell="${effect.command.q},${effect.command.r}"]`);
  await target.hover();
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
  await target.click();
  await expect(page.getByRole('button', { name: '确认选择', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  const saved = await archive(page);
  const submitted = saved.commands.filter(entry => entry.command.type === 'resolve' && entry.command.choiceId === session.state.pending!.id);
  expect(submitted).toHaveLength(1);
  expect(submitted[0]!.command.options).toHaveLength(1);
});

test('体验：选中动物后直接开始行动，保留选卡并完成安置', async ({ page }) => {
  let seed = 0;
  while (!createSession(arkGame, {}, seed).state.players[0]!.hand.includes('405')) seed += 1;
  let session = preparedArk(seed, ['405']);
  session = arkSubmit(session, { type: 'take-x', action: 'animals' });
  const { arkActor, chooseArkCommand } = await import('@eurogame/game-ark-nova');
  while (arkActor(session.state) !== 'p1') {
    const actor = arkActor(session.state);
    session = arkSubmit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
  }
  await importGame(page, session);
  await page.getByTestId('ark-hand').getByRole('button', { name: '查看 耳廓狐', exact: true }).click();
  await page.getByLabel('使用 X 标记', { exact: true }).fill('1');
  await page.getByRole('button', { name: '开始动物行动', exact: true }).click();
  await expect(page.locator('.ark-detail h2')).toHaveText('耳廓狐');
  await page.getByRole('button', { name: '确认安置动物', exact: true }).click();
  await expect(page.getByTestId('ark-money')).toHaveText('17 ◈');
});

test('资产：目录跨页面共享、原图优先、导出包含尺寸和来源', async ({ page, request }) => {
  const response = await request.get('/__ark_reference__/catalog.json');
  const catalog = response.ok() ? await response.json() : BUILTIN_CATALOG;
  let requests = 0;
  page.on('request', request => { if (request.url().includes('/catalog.json')) requests += 1; });
  await importGame(page, preparedArk(42));
  await expect(page.locator('.ark-icon-sprite img')).toHaveCount(0);
  await page.getByRole('link', { name: '美术资源', exact: true }).click();
  await expect(page.getByRole('heading', { name: '方舟美术资源', exact: true })).toBeVisible();
  expect(requests).toBe(1);
  if (catalog.referenceAvailable) {
    await page.getByLabel('查找美术资源', { exact: true }).fill('card.203');
    await expect(page.locator('.asset-file')).toHaveCount(1);
    await expect(page.locator('.asset-file img')).toHaveAttribute('src', /S203_Veterinarian\.jpg\?v=/);
    await expect(page.locator('.asset-file')).toContainText('原图');
  } else await expect(page.getByText('内置矢量图已准备', { exact: true })).toBeVisible();
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出资源诊断', exact: true }).click();
  const path = await (await waiting).path();
  if (!path) throw new Error('资源目录导出失败。');
  const exported = JSON.parse(await readFile(path, 'utf8'));
  expect(exported.source.usage).toBe('local-reference-only');
  expect(exported.formatVersion).toBe(1);
  for (const file of exported.files) {
    expect(file.width).toBeGreaterThan(0);
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
  }
});

test('资产：损坏图集只加载一次并统一回退，仍能进行正常操作', async ({ page }) => {
  const src = '/__ark_reference__/projects.jpg?v=0000000000000000';
  const catalog = { ...BUILTIN_CATALOG, referenceAvailable: true, revision: 'broken-atlas', files: [{
    id: 'atlas.projects', alias: 'projectAtlas', kind: 'atlas', label: '保护项目', file: 'projects.jpg', src,
    width: 2262, height: 1596, bytes: 100, sha256: '0'.repeat(64), usage: 'local-reference-only', variant: 'original'
  }] };
  let attempts = 0;
  await page.route('**/__ark_reference__/catalog.json*', route => route.fulfill({ json: catalog }));
  await page.route('**/__ark_reference__/projects.jpg*', route => { attempts += 1; return route.fulfill({ status: 404 }); });
  await importGame(page, preparedArk(42));
  await expect(page.locator('.ark-project-art .ark-artwork').first()).toHaveAttribute('data-asset-status', 'failed');
  await expect(page.locator('.ark-project-art .ark-art-fallback').first()).toBeVisible();
  await expect(page.locator('.ark-project-art .ark-art-sprite')).toHaveCount(0);
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认建造', exact: true })).toBeEnabled();
});

test('体验：减少动态效果时仍显示资源反馈，行动重排没有动画', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await importGame(page, preparedArk(42));
  await page.getByRole('button', { name: '选择建造行动', exact: true }).click();
  await page.getByRole('button', { name: '确认建造', exact: true }).click();
  await expect(page.getByTestId('ark-money')).toHaveText('23 ◈');
  await expect(page.locator('.ark-resource-delta.negative').filter({ hasText: '-2' })).toBeVisible();
  expect(await page.locator('[data-testid=ark-actions]').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});
