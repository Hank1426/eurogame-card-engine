import { expect, test, type Page } from '@playwright/test';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, projectById, zooCard, type ArkSession } from '@eurogame/game-ark-nova';
import { arkSubmit, naturalCheckpoint, preparedArk, terrainCheckpoint } from './ark-checkpoints.js';

async function open(page: Page, session: ArkSession) {
  await page.goto('./');
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'guide.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(session)) });
  await expect(page.getByTestId('ark-table')).toBeVisible();
}

test('指引：动物缺口联动本人图标，悬停与键盘说明不消耗资源', async ({ page }) => {
  let seed = 0;
  while (!createSession(arkGame, {}, seed).state.players[0]!.hand.includes('406')) seed += 1;
  const session = preparedArk(seed, ['406']);
  await open(page, session);
  await page.getByTestId('ark-hand').getByRole('button', { name: '查看 西伯利亚虎', exact: true }).click();
  const check = page.getByTestId('requirement-asia');
  await check.hover();
  await expect(page.getByRole('tooltip')).toContainText('需要 3，已有 0');
  await expect(page.getByRole('tooltip')).toContainText('还缺 3');
  await expect(page.getByTestId('p1-tag-asia')).toHaveClass(/guide-linked/);
  await expect(page.getByTestId('p2-tag-asia')).not.toHaveClass(/guide-linked/);
  const target = (await check.boundingBox())!;
  const tooltip = (await page.getByRole('tooltip').boundingBox())!;
  expect(tooltip.x + tooltip.width <= target.x || tooltip.x >= target.x + target.width || tooltip.y + tooltip.height <= target.y || tooltip.y >= target.y + target.height).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByTestId('p1-tag-asia')).not.toHaveClass(/guide-linked/);
  await check.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByRole('button', { name: '开始动物行动', exact: true })).toBeDisabled();
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
  await expect(page.getByTestId('ark-money')).toHaveText('25 ◈');
});

test('指引：公共项目显示缺口，已入园来源可联动而手牌不算来源', async ({ page }) => {
  const session = naturalCheckpoint(current => current.state.turns >= 20 && current.state.stage === 'turn' && current.state.activePlayer === 'p1' && current.state.players[0]!.animals.length > 0);
  const player = session.state.players[0]!;
  const id = player.animals[0]!;
  const tag = zooCard(id).tags[0]!;
  await open(page, session);
  await page.getByRole('tab', { name: '我的园区', exact: true }).click();
  await page.getByTestId(`p1-tag-${tag}`).hover();
  await expect(page.locator(`.ark-tableau-cards [data-card-id="${id}"]`)).toHaveClass(/guide-source/);
  await expect(page.getByRole('tooltip')).toContainText(zooCard(id).name);
  await expect(page.getByRole('tooltip')).toContainText('手牌不计入');
  await page.keyboard.press('Escape');
  await expect(page.locator('.guide-source')).toHaveCount(0);
  await page.getByRole('tab', { name: '保护项目', exact: true }).click();
  const slot = session.state.projects.find(slot => !projectById(slot.id).tag.startsWith('all-'))!;
  const project = projectById(slot.id);
  await page.getByTestId(`project-check-${project.id}-${project.thresholds[0]}`).hover();
  await expect(page.getByTestId(`p1-tag-${project.tag}`)).toHaveClass(/guide-linked/);
  await expect(page.getByRole('tooltip')).toContainText(`需要 ${project.thresholds[0]}`);
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
});

test('指引：水岩条件只关联实际地形，容量与费用仍分别检查', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const session = terrainCheckpoint(true);
  await open(page, session);
  await page.getByTestId('ark-hand').getByRole('button', { name: '查看 新澳海狗', exact: true }).click();
  await page.getByTestId('requirement-rock').hover();
  await expect(page.locator('.ark-map-panel')).toHaveAttribute('data-guided-terrain', 'rock');
  await expect(page.locator('.ark-map .rock.adjacent-terrain')).toHaveCount(1);
  await expect(page.locator('.ark-map .water.adjacent-terrain')).toHaveCount(0);
  await expect(page.getByTestId('p1-tag-rock')).not.toHaveClass(/guide-linked/);
  await expect(page.getByRole('tooltip')).toContainText('右侧水岩卡面图标数量不用于这项条件');
  await page.getByTestId('requirement-enclosure').hover();
  await expect(page.getByRole('tooltip')).toContainText('可安置区');
  expect(await page.locator('.ark-map .eligible-housing').count()).toBeGreaterThan(0);
  await page.getByTestId('requirement-money').hover();
  await expect(page.getByTestId('p1-money')).toHaveClass(/guide-linked/);
  await expect(page.getByRole('tooltip')).toContainText('不能预支');
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
});

test('指引：禁用行动也可查看能力，X 预览和当前执行的额度分别说明', async ({ page }) => {
  let session = preparedArk(42);
  await open(page, session);
  await expect(page.getByRole('button', { name: '选择动物行动', exact: true })).toBeDisabled();
  await page.getByTestId('action-help-animals').hover();
  await expect(page.getByRole('tooltip')).toContainText('最多安置 0 只');
  await expect(page.getByRole('tooltip')).toContainText('当前不能开始');
  for (const action of ['build', 'cards', 'association', 'sponsors']) {
    await page.getByTestId(`action-help-${action}`).hover();
    await expect(page.getByRole('tooltip').locator('.ark-action-comparison > section')).toHaveCount(2);
  }
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
  session = arkSubmit(session, { type: 'take-x', action: 'animals' });
  while (arkActor(session.state) !== 'p1') {
    const actor = arkActor(session.state);
    session = arkSubmit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
  }
  await open(page, session);
  await page.getByLabel('使用 X 标记', { exact: true }).fill('1');
  await page.getByTestId('action-help-cards').hover();
  await expect(page.getByRole('tooltip')).toContainText('+ 1 X');
  await expect(page.getByTestId('ark-revision')).toHaveText(String(session.state.revision));
  session = arkSubmit(session, { type: 'begin', action: 'cards', spendX: 1 });
  await open(page, session);
  await page.getByTestId('action-help-cards').hover();
  await expect(page.getByRole('tooltip')).toContainText('已消耗 1 X');
  await expect(page.getByRole('tooltip')).toContainText(`剩余额度 ${session.state.context!.remaining}`);
});
