import { TAG_NAMES } from '@eurogame/game-ark-nova';
import { spriteStyle } from '../../asset-definitions.js';
import { ArkGlyph } from './ArkGlyph.js';
import { useAssetStatus } from './asset-store.js';
export const ICON_NAMES: Record<string, string> = {
  ...TAG_NAMES, money: '资金', appeal: '魅力', conservation: '保护', reputation: '声望', worker: '事务员',
  x: 'X 标记', animalsII: '动物 II', sponsorsII: '赞助商 II', 'Partner Zoo': '对应大洲合作动物园', enclosure: '饲养区',
  water: '水域', rock: '岩石', kiosk: '贩售亭', pavilion: '休憩亭',
  animals: '动物', build: '建造', cards: '卡牌', association: '协会', sponsors: '赞助商'
};
export function ArkIcon({ name, assets = {} }: { name: string; assets?: Record<string, string> }) {
  const sprite = spriteStyle(`badge.${name}`);
  const atlas = assets.badges;
  const status = useAssetStatus(atlas);
  const showAtlas = sprite && atlas && status === 'ready';
  return <span className={`ark-icon icon-${name.replaceAll(' ', '-')} ${showAtlas ? 'has-badge' : 'builtin-glyph'}`} role="img" aria-label={ICON_NAMES[name] ?? name} title={ICON_NAMES[name] ?? name}>
    {showAtlas ? <span className="ark-icon-sprite" style={{ ...sprite, backgroundImage: `url("${atlas}")` }} /> : <ArkGlyph name={name} />}
  </span>;
}
