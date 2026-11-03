import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { applyCommand, createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand } from '@eurogame/game-ark-nova';

const directory = '.artifacts/ui';
await mkdir(directory, { recursive: true });
let session = createSession(arkGame, {}, 0);
for (let step = 0; step < 1000; step += 1) {
  if (session.state.turns >= 20 && session.state.stage === 'turn' && !session.state.pending && session.state.activePlayer === 'p1') break;
  const actor = arkActor(session.state);
  const command = chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!);
  const outcome = applyCommand(arkGame, session, { id: `capture-${step}`, actor, revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(outcome.error.message);
  session = outcome.session;
}
await writeFile(`${directory}/ark-midgame.replay.json`, exportArchive(session));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/eurogame-card-engine/');
  await page.getByRole('button', { name: /方舟动物园/ }).click();
  await page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true }).click();
  await page.locator('.ark-choice-options .ark-card').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${directory}/ark-setup.png`, fullPage: true });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: `${directory}/ark-setup-${viewport.width}.png` });
  }
  await page.getByLabel('导入对局文件').setInputFiles(`${directory}/ark-midgame.replay.json`);
  await page.getByRole('button', { name: '选择建造行动', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${directory}/ark-table.png`, fullPage: true });
  await page.screenshot({ path: `${directory}/ark-table-viewport.png` });
  await page.getByTestId('p1-income').hover();
  await page.getByRole('tooltip').waitFor();
  await page.screenshot({ path: `${directory}/ark-income-detail.png` });
  await page.keyboard.press('Escape');
  await page.locator('.ark-board-columns').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/ark-map-viewport.png` });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    const cards = page.getByTestId('ark-hand').locator('.ark-card');
    if (await cards.count()) await cards.first().click();
    else await page.getByTestId('ark-market').locator('.ark-card').first().click();
    await page.screenshot({ path: `${directory}/ark-inspector-${viewport.width}.png` });
  }
  await page.goto('http://127.0.0.1:4173/eurogame-card-engine/#/lobby');
  await page.getByRole('button', { name: /方舟动物园/ }).click();
  await page.getByLabel('动物园地图', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true }).click();
  await page.locator('.ark-choice-options .ark-card').first().waitFor();
  await page.screenshot({ path: `${directory}/ark-map0-setup.png`, fullPage: true });
  for (let index = 0; index < 4; index += 1) await page.locator('.ark-choice-options .ark-card').nth(index).click();
  await page.getByRole('button', { name: '确认选择', exact: true }).click();
  await page.getByTestId('ark-turn-status').filter({ hasText: '轮到你行动' }).waitFor();
  await page.locator('.ark-board-columns').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/ark-map0-viewport.png` });
  for (const map of ['1', '2']) {
    await page.goto('http://127.0.0.1:4173/eurogame-card-engine/#/lobby');
    await page.getByRole('button', { name: /方舟动物园/ }).click();
    await page.getByLabel('动物园地图', { exact: true }).selectOption(map);
    await page.getByRole('button', { name: '创建方舟对局 · 与 AI 开始', exact: true }).click();
    await page.locator('.ark-choice-options .ark-card').first().waitFor();
    for (let index = 0; index < 4; index += 1) await page.locator('.ark-choice-options .ark-card').nth(index).click();
    await page.getByRole('button', { name: '确认选择', exact: true }).click();
    await page.getByTestId('ark-turn-status').filter({ hasText: '轮到你行动' }).waitFor();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${directory}/ark-map${map}-viewport.png` });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: `${directory}/ark-map${map}-1366.png` });
    await page.setViewportSize({ width: 1920, height: 1080 });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('已生成地图 A / 0 / 1 / 2、双人信息、收入明细，以及三个桌面尺寸的留牌与操作面板截图。');
} finally { await browser.close(); }
