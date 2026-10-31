import { readFile, readdir, mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { parseEnums, parseExport } from './ark-source-parser.js';
import { arkReferenceSchema } from '../packages/content/src/reference.js';

const { values } = parseArgs({ options: { source: { type: 'string', default: 'references/Next-Ark-Nova-Cards' } } });
const root = await realpath(values.source!);
const sourceRoot = join(root, 'src');
const filePaths = [
  ...(await readdir(join(sourceRoot, 'types'))).filter(name => name.endsWith('.ts')).sort().map(name => `src/types/${name}`),
  'src/data/Animals.ts', 'src/data/Sponsors.ts', 'src/data/Projects.ts', 'src/data/EndGames.ts',
  'public/locales/zh-CN/common.json', 'public/locales/en/common.json'
];
const files = await Promise.all(filePaths.map(async path => {
  const absolute = await realpath(resolve(root, path));
  const local = relative(root, absolute);
  if (isAbsolute(local) || local.startsWith('..')) throw new Error('来源文件越出参考仓库。');
  const text = await readFile(absolute, 'utf8');
  return { path, text, sha256: createHash('sha256').update(text).digest('hex') };
}));
const enums = parseEnums(files.filter(file => file.path.startsWith('src/types/')).map(file => file.text));
const dataFiles = [
  { path: 'src/data/Animals.ts', exportName: 'AnimalsData', category: 'animal' },
  { path: 'src/data/Sponsors.ts', exportName: 'SponsorsData', category: 'sponsor' },
  { path: 'src/data/Projects.ts', exportName: 'ProjectsData', category: 'project' },
  { path: 'src/data/EndGames.ts', exportName: 'EndGameData', category: 'endgame' }
];
const cards = dataFiles.flatMap(file => parseExport(files.find(item => item.path === file.path)!.text, file.exportName, enums).flatMap(record => {
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.source !== 'Base') return [];
  const category = file.category === 'project' && record.type === 'Base' ? 'base-project' : file.category;
  return [{ id: String(record.id), name: String(record.name), category, raw: record, implementation: 'unimplemented' as const }];
}));
let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  console.warn('来源不含 Git 元数据，导入结果以文件 SHA-256 追踪。');
}
const licenseFiles = (await readdir(root)).filter(name => /^(license|copying|notice)(\.|$)/i.test(name));
const pack = arkReferenceSchema.parse({
  formatVersion: 1,
  source: {
    repository: 'https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards',
    commit,
    license: licenseFiles.length ? `review-required: ${licenseFiles.join(', ')}` : 'no-license-file-found',
    files: files.map(({ path, sha256 }) => ({ path, sha256 }))
  },
  cards,
  locales: Object.fromEntries(files.filter(file => file.path.endsWith('common.json')).map(file => [
    file.path.includes('zh-CN') ? 'zh-CN' : 'en', JSON.parse(file.text) as unknown
  ]))
});
const expectedCounts = { animal: 128, sponsor: 64, project: 20, 'base-project': 12, endgame: 11 };
for (const [category, expected] of Object.entries(expectedCounts)) {
  const actual = pack.cards.filter(card => card.category === category).length;
  if (actual !== expected) throw new Error(`基础版 ${category} 数量为 ${actual}，预期 ${expected}；未覆盖现有导入文件。`);
}
const destination = resolve('content/private/ark-nova.reference.json');
await mkdir(resolve('content/private'), { recursive: true });
await writeFile(destination, JSON.stringify(pack, null, 2) + '\n', 'utf8');
const counts = Object.fromEntries(['animal', 'sponsor', 'project', 'base-project', 'endgame'].map(category => [category, pack.cards.filter(card => card.category === category).length]));
console.log(JSON.stringify({ destination, commit, license: pack.source.license, counts, total: pack.cards.length, executableCards: 0 }, null, 2));
