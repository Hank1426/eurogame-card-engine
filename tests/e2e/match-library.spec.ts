import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { demoGame } from '@eurogame/game-demo';
import { arkGame } from '@eurogame/game-ark-nova';

async function exported(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '↧ 导出对局', exact: true }).click();
  const path = await (await download).path();
  return JSON.parse(await readFile(path!, 'utf8'));
}
async function create(page: Page, game: 'garden-lab' | 'ark-nova', seed: number, map = 'A') {
  await page.goto('./#/lobby');
  await page.getByRole('button', { name: game === 'ark-nova' ? /方舟动物园/ : /植序工坊/ }).click();
  if (game === 'ark-nova') await page.getByLabel('动物园地图', { exact: true }).selectOption(map);
  await page.locator('.seed-settings summary').click();
  await page.getByRole('textbox', { name: '随机种子', exact: true }).fill(String(seed));
  await page.getByRole('button', { name: game === 'ark-nova' ? '创建方舟对局 · 与 AI 开始' : '创建对局 · 与 AI 开始', exact: true }).click();
  await expect(page).toHaveURL(/#\/matches\/[^/]+$/);
  await expect(page.getByTestId(game === 'ark-nova' ? 'ark-table' : 'revision')).toBeVisible();
  return page.url();
}

test('对局库：两局方舟与两局 Demo 独立保留，切换刷新导出不串局', async ({ page }) => {
  const a = await create(page, 'ark-nova', 41, 'A');
  const b = await create(page, 'ark-nova', 42, '0');
  const c = await create(page, 'garden-lab', 43);
  const d = await create(page, 'garden-lab', 44);
  expect(new Set([a, b, c, d]).size).toBe(4);
  for (const [url, id, seed, map] of [[a, 'ark-nova', 41, 'A'], [c, 'garden-lab', 43, null], [b, 'ark-nova', 42, '0'], [d, 'garden-lab', 44, null]] as const) {
    await page.goto(url); await expect(page.getByTestId(id === 'ark-nova' ? 'ark-table' : 'revision')).toBeVisible();
    await page.reload(); await expect(page.getByTestId(id === 'ark-nova' ? 'ark-table' : 'revision')).toBeVisible();
    const archive = await exported(page);
    expect(archive.seed).toBe(seed); expect(archive.manifest.gameId).toBe(id);
    if (map) expect(archive.config.map).toBe(map);
  }
  await page.getByRole('link', { name: '我的对局', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(4);
});

test('对局库：重命名、归档与恢复保留对局，导入相同种子仍建新局', async ({ page }) => {
  await create(page, 'garden-lab', 42);
  await page.getByRole('link', { name: '我的对局', exact: true }).click();
  await page.getByRole('button', { name: '重命名', exact: true }).click();
  await page.getByLabel('对局名称', { exact: true }).fill('我的资源实验');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的资源实验', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '归档', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(0);
  await page.getByRole('button', { name: '已归档 1', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(1);
  await page.getByRole('button', { name: '恢复归档', exact: true }).click();
  await page.getByRole('button', { name: '当前对局 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的资源实验', exact: true })).toBeVisible();
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'same-seed.json', mimeType: 'application/json', buffer: Buffer.from(exportArchive(createSession(demoGame, {}, 42))) });
  await expect(page.getByTestId('revision')).toBeVisible();
  await page.getByRole('link', { name: '我的对局', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(2);
});

test('迁移：旧两槽保留原文件且幂等；大厅不加载牌桌，继续才恢复', async ({ page }) => {
  const demo = exportArchive(createSession(demoGame, {}, 42));
  const ark = exportArchive(createSession(arkGame, { map: '0' }, 43));
  await page.addInitScript(({ demo, ark }) => {
    // Seed v1 once, before the application requests its v2 upgrade.
    if (sessionStorage.getItem('legacy-seeded')) return;
    sessionStorage.setItem('legacy-seeded', 'true');
    const request = indexedDB.open('eurogame-engine-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => { const db = request.result; const transaction = db.transaction('saves', 'readwrite'); transaction.objectStore('saves').put(demo, 'current'); transaction.objectStore('saves').put(ark, 'ark-current'); transaction.oncomplete = () => db.close(); };
  }, { demo, ark });
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('./');
  await expect(page.getByRole('link', { name: '继续方舟对局', exact: true })).toBeVisible();
  expect(requests.some(url => /(?:demo|ark)-adapter-/.test(url))).toBe(false);
  await page.getByRole('link', { name: '我的对局', exact: true }).click();
  await expect(page.locator('.match-row')).toHaveCount(2);
  await page.reload(); await expect(page.locator('.match-row')).toHaveCount(2);
  await page.locator('[data-match-id="legacy-ark-current"]').getByRole('link', { name: '继续', exact: true }).click();
  await expect(page.getByTestId('ark-table')).toBeVisible();
  expect(requests.some(url => /ark-adapter-/.test(url))).toBe(true);
  const archive = await exported(page); expect(archive.config.map).toBe('0');
  const old = await page.evaluate(() => new Promise(resolve => { const request = indexedDB.open('eurogame-engine-lab'); request.onsuccess = () => { const db = request.result; const read = db.transaction('saves', 'readonly').objectStore('saves').get('ark-current'); read.onsuccess = () => { resolve(read.result); db.close(); }; }; }));
  expect(old).toBe(ark);
});

test('存档恢复：损坏旧存档仍能在对局库原样导出', async ({ page }) => {
  const broken = '{"formatVersion":0,"original":"keep-me"}';
  await page.addInitScript(raw => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', 'true');
    const request = indexedDB.open('eurogame-engine-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => { const db = request.result; const transaction = db.transaction('saves', 'readwrite'); transaction.objectStore('saves').put(raw, 'current'); transaction.oncomplete = () => db.close(); };
  }, broken);
  await page.goto('./#/matches'); await expect(page.locator('.match-row')).toHaveCount(1);
  await expect(page.locator('.match-row')).toContainText('原始存档待恢复');
  const downloading = page.waitForEvent('download');
  await page.locator('.match-row').getByRole('button', { name: '导出', exact: true }).click();
  expect(await readFile((await (await downloading).path())!, 'utf8')).toBe(broken);
  await page.locator('.match-row').getByRole('link', { name: '继续', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('多标签：同局第二页只读，第一页面关闭后可重新载入接管', async ({ page, context }) => {
  const url = await create(page, 'garden-lab', 42);
  const other = await context.newPage(); await other.goto(url);
  await expect(other.getByText('此对局正在另一页面操作，本页只读。', { exact: false })).toBeVisible();
  await expect(other.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true }).click();
  await expect(page.getByTestId('turn-status')).toHaveText('轮到你行动');
  await expect(page.getByTestId('revision')).toHaveText('2');
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  await page.close();
  await expect.poll(async () => (await other.evaluate(() => navigator.locks.query())).held?.some(lock => lock.name === `eurogame-match:${url.split('/matches/')[1]}`)).toBe(false);
  await other.getByRole('button', { name: '重新载入并尝试接管', exact: true }).click();
  await expect(other.getByTestId('revision')).toHaveText('2');
  await expect(other.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true })).toBeEnabled();
});

test('目录导入：未知游戏不会走 Demo 回退，原局保持不变', async ({ page }) => {
  await create(page, 'garden-lab', 42);
  const data = JSON.parse(exportArchive(createSession(demoGame, {}, 1)));
  data.manifest.gameId = 'unknown-game';
  await page.getByLabel('导入对局文件').setInputFiles({ name: 'unknown.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.getByRole('alert')).toContainText('未知游戏');
  expect((await exported(page)).seed).toBe(42);
});

test('保存冲突：外部更新写入版本后旧页面不能覆盖，内存进度仍可导出', async ({ page }) => {
  const url = await create(page, 'garden-lab', 42);
  const id = url.split('/matches/')[1]!;
  await page.evaluate(id => new Promise<void>(resolve => {
    const request = indexedDB.open('eurogame-engine-lab');
    request.onsuccess = () => {
      const db = request.result; const transaction = db.transaction('matches', 'readwrite');
      const store = transaction.objectStore('matches'); const get = store.get(id);
      get.onsuccess = () => store.put({ ...get.result, writeVersion: get.result.writeVersion + 1 }, id);
      transaction.oncomplete = () => { db.close(); resolve(); };
    };
  }), id);
  await page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('此对局已有更新');
  await expect(page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true })).toBeDisabled();
  const saved = await page.evaluate(id => new Promise<string>(resolve => { const request = indexedDB.open('eurogame-engine-lab'); request.onsuccess = () => { const db = request.result; const get = db.transaction('archives', 'readonly').objectStore('archives').get(id); get.onsuccess = () => { db.close(); resolve(get.result); }; }; }), id);
  expect(JSON.parse(saved).snapshot.revision).toBe(0);
  expect((await exported(page)).snapshot.revision).toBe(1);
});

test('AI 隔离：切到新局后旧局停在已保存修订，重新继续才执行 AI', async ({ page }) => {
  const first = await create(page, 'garden-lab', 41);
  await page.getByRole('button', { name: '经营 · +2 ◈ +1 ✧', exact: true }).click();
  await page.getByRole('link', { name: '我的对局', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已自动保存在此浏览器' })).toBeVisible();
  const second = await create(page, 'garden-lab', 43);
  expect((await exported(page)).snapshot.revision).toBe(0);
  const stored = await page.evaluate(id => new Promise<string>(resolve => { const request = indexedDB.open('eurogame-engine-lab'); request.onsuccess = () => { const db = request.result; const get = db.transaction('archives', 'readonly').objectStore('archives').get(id); get.onsuccess = () => { resolve(get.result); db.close(); }; }; }), first.split('/matches/')[1]!);
  expect(JSON.parse(stored).snapshot.revision).toBe(1);
  await page.goto(first);
  await expect(page.getByTestId('revision')).toHaveText('2');
  await page.goto(second);
  await expect(page.getByTestId('revision')).toHaveText('0');
});
