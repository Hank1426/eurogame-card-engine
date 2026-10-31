import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildAssetCatalog } from '../apps/web/asset-inventory.js';
import { assetPolicySchema } from './asset-policy.js';

const policy = assetPolicySchema.parse(JSON.parse(await readFile('content/assets/policy.json', 'utf8')));
const catalog = await buildAssetCatalog(resolve(policy.referenceRoot));
await mkdir('.artifacts/assets', { recursive: true });
await writeFile('.artifacts/assets/catalog.json', JSON.stringify(catalog, null, 2));
console.log(JSON.stringify({
  revision: catalog.revision, referenceAvailable: catalog.referenceAvailable, files: catalog.files.length,
  bytes: catalog.files.reduce((total, file) => total + file.bytes, 0), issues: catalog.issues,
  report: '.artifacts/assets/catalog.json'
}, null, 2));
if (catalog.issues.length) process.exitCode = 1;
