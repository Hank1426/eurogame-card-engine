import type { CSSProperties } from 'react';
import { zooCard } from '@eurogame/game-ark-nova';
import { spriteStyle } from '../../asset-definitions.js';
import { ArkIcon } from './ArkIcon.js';
import { markAssetFailed, useAssetStatus } from './asset-store.js';

export function projectSprite(id: string): CSSProperties | null {
  return spriteStyle(`project.${id}`);
}

export function ArkArtwork({ id, assets }: { id: string; assets: Record<string, string> }) {
  const sprite = projectSprite(id);
  const source = sprite ? assets.projectAtlas : assets[id];
  const status = useAssetStatus(source);
  return <div className={`ark-artwork ${sprite ? 'project-artwork' : ''}`} data-art-id={id} data-asset-status={status ?? (source ? 'available' : 'builtin')}>
    <div className="ark-art-fallback"><svg viewBox="0 0 300 160" aria-hidden="true"><circle cx="238" cy="36" r="22" fill="#f6dda1" /><path d="M0 140 72 42 130 116 196 61 300 150V160H0Z" fill="#658d76" /><path d="m0 160 86-75 90 75 70-52 54 30v22Z" fill="#315e51" /><path d="M180 160q-35-30-6-49t-12-32q61 24 34 47t32 34" fill="#b5d5d1" /></svg><ArkIcon name={sprite ? 'conservation' : zooCard(id).tags[0] ?? 'science'} assets={assets} /></div>
    {source && status !== 'failed' && (sprite
      ? status === 'ready' && <div className="ark-art-sprite" role="img" aria-label={`${id} 保护项目插画`} style={{ ...sprite, backgroundImage: `url("${source}")` }} />
      : <img className="ark-art-photo" src={source} alt="" loading="lazy" decoding="async" onError={() => markAssetFailed(source)} />)}
  </div>;
}
