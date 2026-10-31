import { useState } from 'react';
import { TAG_NAMES } from '@eurogame/game-ark-nova';

const badgePositions: Record<string, [number, number]> = {
  animals: [0, 0], animalsII: [1, 0], build: [2, 0], cards: [4, 0], sponsors: [1, 1], sponsorsII: [2, 1],
  worker: [3, 1], africa: [0, 2], americas: [1, 2], asia: [2, 2], australia: [3, 2], europe: [4, 2],
  appeal: [0, 3], 'Partner Zoo': [1, 3], reputation: [2, 3], science: [3, 3],
  primate: [0, 4], bear: [1, 4], bird: [3, 4], predator: [4, 4],
  herbivore: [0, 5], reptile: [1, 5], pet: [2, 5]
};
const symbols: Record<string, string> = {
  predator: '🐾', herbivore: '🦌', primate: '🐒', reptile: '🦎', bird: '🦅', bear: '🐻', pet: '🐐',
  africa: '非', americas: '美', australia: '澳', asia: '亚', europe: '欧', science: '⚗',
  money: '◈', appeal: '♟', conservation: '⬟', reputation: '◆', worker: '♟', x: 'X',
  animals: '🐾', animalsII: 'II', build: '⬡', cards: '▤', association: '♟', sponsors: '◈',
  'Partner Zoo': '🌐', enclosure: '⬡', 'all-animals': '🐾', 'all-continents': '🌐'
};
export const ICON_NAMES: Record<string, string> = {
  ...TAG_NAMES, money: '资金', appeal: '魅力', conservation: '保护', reputation: '声望', worker: '事务员',
  x: 'X 标记', animalsII: '动物 II', sponsorsII: '赞助商 II', 'Partner Zoo': '对应大洲合作动物园', enclosure: '饲养区',
  water: '水域', rock: '岩石', kiosk: '贩售亭', pavilion: '休憩亭',
  animals: '动物', build: '建造', cards: '卡牌', association: '协会', sponsors: '赞助商'
};
export function ArkIcon({ name, assets = {} }: { name: string; assets?: Record<string, string> }) {
  const [failed, setFailed] = useState('');
  const position = badgePositions[name];
  const atlas = assets.badges;
  return <span className={`ark-icon icon-${name.replaceAll(' ', '-')} ${position && atlas && failed !== atlas ? 'has-badge' : ''}`} role="img" aria-label={ICON_NAMES[name] ?? name} title={ICON_NAMES[name] ?? name}>
    {position && atlas && failed !== atlas
      ? <span className="ark-icon-sprite" style={{ backgroundImage: `url("${atlas}")`, backgroundPosition: `${position[0] * 25}% ${position[1] * 100 / 6}%` }}><img src={atlas} alt="" onError={() => setFailed(atlas)} /></span>
      : name === 'water' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2Q3 13 5 17a8 8 0 0 0 14 0Q21 13 12 2" fill="#448da3" /><path d="M7 15q-1 4 4 5" stroke="#cfe8ee" fill="none" strokeWidth="2" /></svg>
      : name === 'rock' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 18 4-12 9-3 7 12-4 6-13-1Z" fill="#736d65" /><path d="m6 6 6 7 3-10m-3 10L5 20m7-7 10 2" fill="none" stroke="#c5bba9" strokeWidth="1.5" /></svg>
      : name === 'kiosk' || name === 'pavilion' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 3-6h12l3 6M5 10v11h14V10" fill={name === 'kiosk' ? '#bd7249' : '#7e8b64'} stroke="#493e32" strokeWidth="1.5" /><path d="M2 9h20M8 4v5m8-5v5M8 14h8v7" fill="none" stroke="#fff0cc" strokeWidth="2" /></svg>
      : <span aria-hidden="true">{symbols[name] ?? '✦'}</span>}
  </span>;
}
