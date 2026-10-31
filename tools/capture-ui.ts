import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const output = '.artifacts/ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1080 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/eurogame-card-engine/');
  await page.getByRole('button', { name: '创建对局 · 与 AI 开始', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/lobby.png`, fullPage: true });
  await page.getByRole('button', { name: '创建对局 · 与 AI 开始', exact: true }).click();
  await page.getByTestId('hand').getByRole('button').first().waitFor();
  await page.screenshot({ path: `${output}/workbench.png`, fullPage: true });
  await page.screenshot({ path: `${output}/workbench-viewport.png` });
  await page.locator('nav a[href="#/rules"]').click();
  await page.getByRole('heading', { name: '植序工坊 · 游戏规则', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/rules.png`, fullPage: true });
  await page.locator('a[href="#/layout"]').click();
  await page.getByRole('button', { name: '确认建造 · 6 ◈', exact: true }).waitFor();
  await page.screenshot({ path: `${output}/layout.png`, fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Screenshots: ${output}/lobby.png, ${output}/workbench.png, ${output}/rules.png, ${output}/layout.png`);
} finally {
  await browser.close();
}
