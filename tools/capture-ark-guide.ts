import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { applyCommand, createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand } from '@eurogame/game-ark-nova';

const directory = '.artifacts/guide-ui';
await mkdir(directory, { recursive: true });
let seed = 0;
while (!createSession(arkGame, {}, seed).state.players[0]!.hand.includes('406')) seed += 1;
let session = createSession(arkGame, {}, seed);
while (session.state.stage === 'setup') {
  const actor = arkActor(session.state);
  const command = actor === 'p1' ? { type: 'resolve' as const, choiceId: session.state.pending!.id, options: ['406', ...session.state.players[0]!.hand.filter(id => id !== '406').slice(0, 3)] }
    : chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!);
  const outcome = applyCommand(arkGame, session, { id: `guide-${session.state.revision}`, actor, revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(outcome.error.message);
  session = outcome.session;
}
await writeFile(`${directory}/opening.replay.json`, exportArchive(session));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:4173/eurogame-card-engine/');
  await page.getByLabel('导入对局文件').setInputFiles(`${directory}/opening.replay.json`);
  await page.getByTestId('ark-hand').getByRole('button', { name: '查看 西伯利亚虎', exact: true }).click();
  await page.waitForLoadState('networkidle');
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.getByTestId('requirement-asia').hover();
    await expect(page.getByRole('tooltip')).toContainText('还缺 3');
    await page.screenshot({ path: `${directory}/requirements-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await page.getByTestId('action-help-cards').hover();
    await expect(page.getByRole('tooltip').locator('.ark-action-comparison')).toBeVisible();
    await page.screenshot({ path: `${directory}/action-cards-${viewport.width}.png` });
    await page.keyboard.press('Escape');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('三个桌面尺寸的条件联动与行动 I/II 说明截图已保存至 .artifacts/guide-ui/。');
} finally { await browser.close(); }
