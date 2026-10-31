import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ATLASES, SPRITES, validateSpriteDefinitions } from '../apps/web/asset-definitions.js';
import { assetPolicySchema, auditPublishedImages, isImageFile } from './asset-policy.js';

const policy = assetPolicySchema.parse(JSON.parse(await readFile('content/assets/policy.json', 'utf8')));
const problems = validateSpriteDefinitions();
await access(policy.builtinArt.implementation);
if (Object.keys(SPRITES).filter(id => id.startsWith('project.')).length !== 32) problems.push('保护项目必须有 32 个有效图集区域。');
for (const item of policy.publicFiles) {
  const bytes = await readFile(item.path);
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) problems.push(`${item.path} 与已审核哈希不一致。`);
}
if (process.argv.includes('--dist')) {
  const collect = async (root: string): Promise<{ path: string; bytes: Uint8Array }[]> => {
    const entries = await readdir(root, { withFileTypes: true });
    const groups = await Promise.all(entries.map(async entry => {
      const path = resolve(root, entry.name);
      return entry.isDirectory() ? collect(path) : isImageFile(path) ? [{ path, bytes: await readFile(path) }] : [];
    }));
    return groups.flat();
  };
  problems.push(...auditPublishedImages(await collect('apps/web/dist'), policy.publicFiles.map(file => file.sha256)));
}
if (problems.length) throw new Error(problems.join('\n'));
console.log(`美术资产：${ATLASES.length} 图集 / ${Object.keys(SPRITES).length} 区域，坐标与发布策略通过${process.argv.includes('--dist') ? '，公开产物图片审计通过' : ''}。`);
