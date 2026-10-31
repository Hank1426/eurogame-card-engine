import { useState, type CSSProperties } from 'react';
import { zooCard } from '@eurogame/game-ark-nova';
import { ArkIcon } from './ArkIcon.js';

export function projectSprite(id: string): CSSProperties | null {
  const index = Number(id) - 101;
  return /^\d{3}$/.test(id) && index >= 0 && index < 32
    ? { backgroundSize: '600% 600%', backgroundPosition: `${index % 6 * 20}% ${Math.floor(index / 6) * 20}%` }
    : null;
}

export function ArkArtwork({ id, assets }: { id: string; assets: Record<string, string> }) {
  const [failed, setFailed] = useState('');
  const sprite = projectSprite(id);
  const source = sprite ? assets.projectAtlas : assets[id];
  return <div className={`ark-artwork ${sprite ? 'project-artwork' : ''}`} data-art-id={id}>
    <div className="ark-art-fallback"><svg viewBox="0 0 300 160" aria-hidden="true"><circle cx="238" cy="36" r="22" fill="#f6dda1" /><path d="M0 140 72 42 130 116 196 61 300 150V160H0Z" fill="#658d76" /><path d="m0 160 86-75 90 75 70-52 54 30v22Z" fill="#315e51" /><path d="M180 160q-35-30-6-49t-12-32q61 24 34 47t32 34" fill="#b5d5d1" /></svg><ArkIcon name={sprite ? 'conservation' : zooCard(id).tags[0] ?? 'science'} assets={assets} /></div>
    {source && source !== failed && (sprite
      ? <div className="ark-art-sprite" role="img" aria-label={`${id} 保护项目插画`} style={{ ...sprite, backgroundImage: `url("${source}")` }}><img src={source} alt="" onError={() => setFailed(source)} /></div>
      : <img className="ark-art-photo" src={source} alt="" loading="lazy" onError={() => setFailed(source)} />)}
  </div>;
}
