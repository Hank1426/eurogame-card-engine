import { readdir, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { gardenPack, gardenFingerprint, arkCoverage } from '@eurogame/content';
import { ZOO_CARDS, BASE_PROJECTS, FINAL_CARDS } from '@eurogame/game-ark-nova';

const manifest = z.object({
  version: z.literal(1),
  publicPacks: z.array(z.object({ path: z.string(), provenance: z.literal('original') }).strict()),
  privateDirectories: z.array(z.string()),
  notes: z.string()
}).strict().parse(JSON.parse(await readFile('content/release-manifest.json', 'utf8')));
const publicFiles = (await readdir('content/public')).sort().map(name => `content/public/${name}`);
const declared = manifest.publicPacks.map(pack => pack.path).sort();
if (JSON.stringify(publicFiles) !== JSON.stringify(declared)) throw new Error('公开内容与发行清单不一致。');
if (declared.some(path => !/^content\/public\/[a-z0-9-]+\.json$/.test(path))) throw new Error('公开包路径无效。');
for (const entry of manifest.publicPacks) {
  const pack = JSON.parse(await readFile(entry.path, 'utf8')) as { provenance?: unknown };
  if (pack.provenance !== entry.provenance) throw new Error('内容来源标识不一致。');
}
if (arkCoverage.targets.reduce((total, category) => total + category.expected, 0) !== 235) throw new Error('基础版目标总数必须为 235。');
if (new Set(arkCoverage.cards.map(card => card.id)).size !== arkCoverage.cards.length) throw new Error('方舟卡牌 ID 重复。');
const implemented = [...ZOO_CARDS.map(card => card.id), ...BASE_PROJECTS.map(project => project.id), ...FINAL_CARDS.map(card => card.id)].sort();
if (JSON.stringify(implemented) !== JSON.stringify(arkCoverage.cards.filter(card => card.implemented).map(card => card.id).sort())) throw new Error('方舟覆盖清单与实际首版牌池不一致。');
for (const card of arkCoverage.cards) {
  if (!arkCoverage.targets.some(target => target.category === card.category)) throw new Error(`未知卡牌类别 ${card.category}`);
  if ((card.implemented && !card.entered) || (card.tested && !card.implemented) || (card.reviewed && !card.tested)) throw new Error('卡牌覆盖状态顺序无效。');
}
for (const rule of arkCoverage.rules) {
  if (['tested', 'reviewed'].includes(rule.status) && !rule.tests.length) throw new Error(`${rule.id} 缺少验证案例。`);
  for (const test of rule.tests) await access(resolve(test));
}
if (arkCoverage.status === 'complete' && (arkCoverage.rules.some(rule => rule.status !== 'reviewed') ||
  arkCoverage.targets.some(target => arkCoverage.cards.filter(card => card.category === target.category && card.reviewed).length !== target.expected))) {
  throw new Error('完整标记与覆盖进度不符。');
}
console.log(`公开包 ${gardenPack.id}：${gardenPack.cards.length} 种 / ${gardenPack.cards.length * gardenPack.copies} 张，指纹 ${gardenFingerprint}。`);
console.log(`方舟：${arkCoverage.cards.filter(card => card.implemented).length}/235 张实现；状态 ${arkCoverage.status}。`);
