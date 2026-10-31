import { tagsOf, animalCost, buildingUsedSpace, adjacentTerrain, housingCapacity, specialSpace, type ArkPlayer, type ArkState, type Building, type ZooCard } from '@eurogame/game-ark-nova';
import { ArkIcon, ICON_NAMES } from './ArkIcon.js';

export function ArkRequirements({ card, player, state, building, source, assets }: {
  card: ZooCard; player?: ArkPlayer; state?: ArkState; building?: Building;
  source?: 'hand' | 'market' | 'tableau'; assets: Record<string, string>;
}) {
  const tags = player ? tagsOf(player) : {};
  const checks: { icon: string; value: string; title: string; met?: boolean }[] = [];
  const counts = Object.fromEntries([...new Set(card.requirements)].map(tag => [tag, card.requirements.filter(candidate => candidate === tag).length]));
  for (const [tag, count] of Object.entries(counts)) {
    const actual = tag === 'animalsII' || tag === 'sponsorsII' ? Number(player?.upgrades.includes(tag === 'animalsII' ? 'animals' : 'sponsors'))
      : tag === 'Partner Zoo' ? Number(card.tags.some(tag => player?.partners.includes(tag))) : tags[tag] ?? 0;
    checks.push({ icon: tag, value: count > 1 ? `×${count}` : '', title: `${ICON_NAMES[tag] ?? tag} ×${count}${player ? ` · 已有 ${actual}` : ''}`, ...(player ? { met: actual >= count } : {}) });
  }
  if (card.kind === 'animal') {
    const capacity = building ? housingCapacity(building, player?.map) : 0;
    const space = building ? specialSpace(card.id, building.kind) : null;
    const suitable = building && (card.tags.includes('pet') ? building.kind === 'petting' && buildingUsedSpace(building) < 3
      : building.kind === 'aviary' || building.kind === 'reptile-house' ? space !== null && buildingUsedSpace(building) + space <= 5
      : building.kind.startsWith('enclosure') && !buildingUsedSpace(building) && capacity >= card.size);
    checks.unshift({ icon: 'enclosure', value: String(card.size), title: card.tags.includes('pet') ? '需要萌宠园空位' : `最低 ${card.size} 格闲置饲养区；特殊馆按卡面容量`, ...(player ? { met: Boolean(suitable) } : {}) });
    for (const terrain of ['water', 'rock'] as const) if (card[terrain]) {
      const actual = building && player ? adjacentTerrain(building.cells, terrain, player.map) : 0;
      checks.push({ icon: terrain, value: player ? `${actual}/${card[terrain]}` : String(card[terrain]), title: `共边邻接的不同${ICON_NAMES[terrain]}格：${actual}，需要 ${card[terrain]}${player ? '（高亮显示于地图）' : ''}`, ...(player ? { met: actual >= card[terrain] } : {}) });
    }
    if (player && state && source && source !== 'tableau') {
      const cost = animalCost(state, player, card.id, source);
      checks.push({ icon: 'money', value: String(cost), title: `费用 ${cost}，现有 ${player.money}`, met: player.money >= cost });
    }
  }
  return <div className="ark-condition-icons" aria-label="打出条件">{checks.map(check =>
    <span className={`ark-condition ${check.met === undefined ? '' : check.met ? 'met' : 'unmet'}`} key={check.icon} title={check.title} aria-label={`${check.title}${check.met === undefined ? '' : check.met ? ' · 满足' : ' · 未满足'}`}>
      <ArkIcon name={check.icon} assets={assets} /><b>{check.value}</b>{check.met !== undefined && <small aria-hidden="true">{check.met ? '✓' : '×'}</small>}
    </span>)}{!checks.length && <span className="tiny">无前置图标</span>}</div>;
}
