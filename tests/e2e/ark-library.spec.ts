import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { exportArchive } from '@eurogame/engine-core';
import { arkGame, zooCard, type ArkSession } from '@eurogame/game-ark-nova';
import { naturalCheckpoint } from './ark-checkpoints.js';

async function load(page: Page, session: ArkSession) {
  await page.goto('./');
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'base-library.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(session)) });
  await expect(page.getByTestId('ark-table')).toBeVisible();
}
async function exported(page: Page) {
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: '↧ 导出对局', exact: true }).click();
  const path = await (await waiting).path();
  if (!path) throw new Error('没有导出文件。');
  return JSON.parse(await readFile(path, 'utf8')) as { commands: { actor: string; command: { type: string; choiceId?: string; options?: string[] } }[]; snapshot: ArkSession['state'] };
}
test('全牌库：独有建筑在地图上旋转和放置，不可跳过，刷新恢复选择', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && current.state.pending.prompt.includes('必须放置'), [1]);
  const placement = arkGame.getPlayerView(session.state, 'p1').pending!.options[0]!.placement!;
  await load(page, session);
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('独有建筑不可镜像');
  await expect(page.getByRole('button', { name: '跳过建造', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('必须放置');
  const cell = page.locator(`.ark-map [data-cell="${placement.q},${placement.r}"]`);
  await cell.click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  const archive = await exported(page);
  expect(archive.snapshot.players[0]!.buildings.filter(building => building.kind === placement.kind)).toHaveLength(1);
  expect(archive.commands.filter(command => command.command.type === 'resolve' && command.command.choiceId === session.state.pending!.id)).toHaveLength(1);
});
test('全牌库：群居自动提供共享选项，打出不增加饲养区占用', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => !current.state.pending && current.state.activePlayer === 'p1' && current.state.context?.action === 'animals' &&
    arkGame.getDecision(current.state, 'p1')!.options.some(option => option.command.type === 'animal' && option.command.building === 'flock'), [3]);
  const command = arkGame.getDecision(session.state, 'p1')!.options.find(option => option.command.type === 'animal' && option.command.building === 'flock')!.command;
  if (command.type !== 'animal') throw new Error('群居检查点错误。');
  await load(page, session);
  await page.getByTestId(command.source === 'hand' ? 'ark-hand' : 'ark-market').getByRole('button', { name: `查看 ${zooCard(command.card).name}`, exact: true }).click();
  await expect(page.getByLabel('饲养区 · 可直接点地图选择', { exact: true })).toHaveValue('flock');
  await page.getByRole('button', { name: '确认安置动物', exact: true }).click();
  const archive = await exported(page);
  expect(archive.snapshot.players[0]!.animals).toContain(command.card);
  expect(archive.snapshot.players[0]!.buildings.map(building => building.occupancy ?? building.animals.length)).toEqual(session.state.players[0]!.buildings.map(building => building.occupancy ?? building.animals.length));
});
test('全牌库：被偷窃者能选择资金，AI 不代操作或泄露手牌', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && current.state.pending.prompt.includes('被偷窃') &&
    current.state.pending.options.some(option => option.id === 'money'), [0]);
  await load(page, session);
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('被偷窃');
  await expect(page.getByTestId('ark-turn-status')).not.toHaveText('AI 正在思考…');
  await page.locator('.ark-choice-option').filter({ hasText: '支付' }).click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  const archive = await exported(page);
  const command = archive.commands.find(command => command.command.choiceId === session.state.pending!.id)!;
  expect(command.actor).toBe('p1');
  expect(command.command.options).toEqual(['money']);
});
test('全牌库：互动时序选择可以刷新后继续，提交只发生一次', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && current.state.pending.prompt.includes('互动效果'), [0]);
  await load(page, session);
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ark-choice-prompt')).toContainText('互动效果时序');
  await page.locator('.ark-choice-option').filter({ hasText: '先结算互动' }).click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  const archive = await exported(page);
  expect(archive.commands.filter(command => command.command.choiceId === session.state.pending!.id)).toHaveLength(1);
});
test('全牌库：额外行动继续同回合，不要求切换座位', async ({ page }) => {
  test.setTimeout(60_000);
  const session = naturalCheckpoint(current => current.state.pending?.actor === 'p1' && /额外|决心/.test(current.state.pending.prompt) &&
    current.state.pending.options.some(option => option.effects.some(item => item.effect.type === 'start-extra-action' && item.effect.command.type === 'begin')), [1]);
  const option = session.state.pending!.options.find(option => option.effects.some(item => item.effect.type === 'start-extra-action' && item.effect.command.type === 'begin'))!;
  await load(page, session);
  await page.locator('.ark-choice-option').filter({ hasText: option.label }).first().click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  const archive = await exported(page);
  expect(archive.snapshot.activePlayer).toBe('p1');
  expect(archive.snapshot.turns).toBe(session.state.turns);
  expect(archive.snapshot.context).not.toBeNull();
});
