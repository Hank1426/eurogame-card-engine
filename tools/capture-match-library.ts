import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const directory = '.artifacts/library-ui';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:4173/eurogame-card-engine/');
  for (const game of ['garden-lab', 'ark-nova', 'garden-lab', 'ark-nova']) {
    await page.locator('nav a[href="#/lobby"]').click();
    await page.getByRole('button', { name: game === 'ark-nova' ? /方舟动物园/ : /植序工坊/ }).click();
    await page.getByRole('button', { name: game === 'ark-nova' ? '创建方舟对局 · 与 AI 开始' : '创建对局 · 与 AI 开始', exact: true }).click();
    await expect(page.getByTestId(game === 'ark-nova' ? 'ark-table' : 'revision')).toBeVisible();
  }
  await page.locator('nav a[href="#/matches"]').click();
  await expect(page.locator('.match-row')).toHaveCount(4);
  await page.locator('.match-row').first().getByRole('button', { name: '重命名', exact: true }).click();
  await page.getByLabel('对局名称', { exact: true }).fill('方舟 · 地图与收入实验');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: `${directory}/matches-${viewport.width}.png` });
    await page.locator('nav a[href="#/lobby"]').click();
    await page.screenshot({ path: `${directory}/lobby-${viewport.width}.png` });
    await page.locator('nav a[href="#/matches"]').click();
  }
  await page.locator('.match-row').first().getByRole('button', { name: '归档', exact: true }).click();
  await page.getByRole('button', { name: '已归档 1', exact: true }).click();
  await page.screenshot({ path: `${directory}/archived.png` });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('对局库、归档和大厅三种桌面尺寸截图已保存至 .artifacts/library-ui/。');
} finally { await browser.close(); }
