import { animalCost, adjacentTerrain, BUILDING_NAMES, cardRequirementChecks, housingCapacity, housingError, buildingUsedSpace, specialSpace, canFlock, zooCard, type ArkPlayer, type ArkState, type Building, type ZooCard } from '@eurogame/game-ark-nova';
import type { ReactNode } from 'react';
import { ArkIcon, ICON_NAMES } from './ArkIcon.js';
import { ArkHint } from './ArkHint.js';
import { useArkGuide } from './ArkGuide.js';
import { iconSources, type GuideFocus } from './guide-model.js';

export function ArkRequirements({ card, player: suppliedPlayer, state, building: suppliedBuilding, source: suppliedSource, assets, interactive = Boolean(suppliedPlayer), useGuide = true }: {
  card: ZooCard; player?: ArkPlayer; state?: Pick<ArkState, 'market'>; building?: Building;
  source?: 'hand' | 'market' | 'tableau'; assets: Record<string, string>; interactive?: boolean; useGuide?: boolean;
}) {
  const context = useArkGuide();
  const guide = useGuide ? context : null;
  const player = guide?.player ?? suppliedPlayer;
  const building = suppliedBuilding ?? player?.buildings.find(building => building.id === guide?.selectedBuilding);
  const market = state?.market ?? guide?.market;
  const source = suppliedSource ?? (player?.hand.includes(card.id) ? 'hand' : market?.includes(card.id) ? 'market' : undefined);
  const checks: { icon: string; value: string; title: string; detail: ReactNode; focus: GuideFocus; met?: boolean }[] = [];
  const focus = (kind: GuideFocus['kind'], key: string): GuideFocus => ({ id: `${card.id}:${kind}:${key}`, kind, key, cardId: card.id });
  const counts = Object.fromEntries([...new Set(card.requirements)].map(tag => [tag, card.requirements.filter(candidate => candidate === tag).length]));
  const conditions = player ? cardRequirementChecks(player, card.id) : Object.entries(counts).map(([tag, count]) => ({ tag, required: tag === 'appeal' ? 25 : tag === 'reputation' ? card.id === '227' || card.id === '263' ? 6 : 3 : count, actual: 0, maximum: tag === 'appeal', missing: count, waived: 0, met: false }));
  for (const check of conditions) {
    const { tag, required, actual, maximum, met, waived } = check;
    const missing = maximum ? Math.max(0, actual - required) : check.missing;
    const title = `${ICON_NAMES[tag] ?? tag} · ${maximum ? `要求不超过 ${required}` : `需要 ${required}`}${player ? ` · 已有 ${actual} · ${met ? waived ? '已减免' : '已满足' : maximum ? `超出 ${missing}` : `还缺 ${missing}`}` : ''}`;
    const sources = player ? iconSources(player, tag, card.id) : [];
    checks.push({ icon: tag, value: maximum ? `≤${required}` : suppliedPlayer ? `${actual}/${required}` : required > 1 ? `×${required}` : '', title,
      detail: <><p>{maximum ? `上限 ${required}，当前 ${actual}` : `需要 ${required}，已有 ${actual}`}{player ? met ? ' · ✓ 满足' : ` · ${maximum ? '超出' : '还缺'} ${missing}` : ''}</p>{waived > 0 && <p>{zooCard('263').name}减免 {waived} 项条件。</p>}{sources.map((item, index) => <p key={index}>{item.label}<b>×{item.count}</b></p>)}{!sources.length && !['appeal', 'reputation', 'animalsII', 'sponsorsII'].includes(tag) && <p>尚无已入园来源。</p>}<small>{tag === 'Partner Zoo' && card.kind === 'animal' ? '必须是这只动物起源大洲的合作动物园；拥有同大洲动物图标不能替代。' : tag === 'animalsII' || tag === 'sponsorsII' ? '按本次实际使用的行动卡面检查；高亮底部对应行动。' : '统计已入园卡牌、合作动物园与大学；手牌不计入。'}</small></>,
      focus: focus('icon', tag), ...(player ? { met } : {}) });
  }
  if (card.kind === 'animal') {
    const flock = Boolean(player && !building && canFlock(player, card.id));
    const suitable = Boolean(building && !housingError(building, card.id, player?.map, true));
    const free = building ? building.kind.startsWith('enclosure') ? buildingUsedSpace(building) ? 0 : housingCapacity(building, player?.map) : (building.kind === 'petting' ? 3 : 5) - buildingUsedSpace(building) : 0;
    const need = building ? specialSpace(card.id, building.kind) ?? card.size : card.tags.includes('pet') ? 1 : card.size;
    const homes = player?.buildings.filter(home => !housingError(home, card.id, player.map, player.sponsors.includes('219'))) ?? [];
    const title = flock ? '群居 · 使用已有食草动物空间' : `饲养区 · 需要 ${need} 格${player ? ` · 可用 ${free} 格 · ${suitable ? '容量与类型满足' : '请选合适饲养区'}` : ''}`;
    checks.unshift({ icon: 'enclosure', value: flock ? '群居' : suppliedPlayer ? `${free}/${need}` : String(card.size), title,
      detail: <><p>{flock ? '群居不占用新的饲养区。' : card.tags.includes('pet') ? '需要萌宠园空位。' : `卡面大小 ${card.size}；标准区须闲置，特殊馆按对应空间标记累计。`}</p>{building && <p>所选：{BUILDING_NAMES[building.kind]} · 可用 {free} 格</p>}<p>{homes.length ? `可安置区 ${homes.length} 个（地图绿色虚线）` : '目前没有同时满足容量与地形的饲养区。'}</p>{homes.map(home => <p key={home.id}>{BUILDING_NAMES[home.kind]}<small>{home.id}</small></p>)}<small>这里只检查安置空间；仍需支付费用并满足卡面图标与行动要求。</small></>, focus: focus('housing', 'enclosure'), ...(player ? { met: suitable || flock } : {}) });
    for (const terrain of ['water', 'rock'] as const) if (card[terrain]) {
      const actual = building && player ? adjacentTerrain(building.cells, terrain, player.map) : 0;
      const waived = player?.sponsors.includes('219') || flock;
      const title = `相邻${ICON_NAMES[terrain]} · 需要 ${card[terrain]}${player ? ` · 已有 ${actual} · ${waived ? '已豁免' : actual >= card[terrain] ? '已满足' : `还缺 ${card[terrain] - actual}`}` : ''}`;
      checks.push({ icon: terrain, value: waived ? flock ? '群居' : '豁免' : suppliedPlayer ? `${actual}/${card[terrain]}` : String(card[terrain]), title,
        detail: <><p>所选区共边邻接 {actual} 个不同{ICON_NAMES[terrain]}格，需要 {card[terrain]}。</p>{waived && <p>{flock ? '群居直接共享已有空间，无须另查新饲养区地形。' : '综合研究员豁免动物的水域与岩石要求。'}</p>}<small>青色圈只标出所选区实际相邻的此类地形。贩售亭不算岩石；右侧水岩卡面图标数量不用于这项条件。</small></>, focus: focus('terrain', terrain), ...(player ? { met: Boolean(waived || actual >= card[terrain]) } : {}) });
    }
    if (suppliedPlayer && player && market && source && source !== 'tableau') {
      const cost = animalCost({ market }, player, card.id, source);
      const fee = source === 'market' ? market.indexOf(card.id) + 1 : 0;
      const title = `资金 · 需要 ${cost} · 已有 ${player.money} · ${player.money >= cost ? '已满足' : `还缺 ${cost - player.money}`}`;
      checks.push({ icon: 'money', value: String(cost), title, met: player.money >= cost, focus: focus('icon', 'money'),
        detail: <><p>卡面 {card.price} + 展示位 {fee} − 优惠 {card.price + fee - cost} = {cost}</p><p>支付后余额 {player.money - cost}。</p><small>合作动物园与相关赞助商优惠已计入。不能预支动物打出后的收益。</small></> });
    }
  }
  return <div className="ark-condition-icons" aria-label="打出条件">{checks.map(check => {
    const label = `${check.title}${check.met === undefined ? '' : check.met ? ' · 满足' : ' · 未满足'}`;
    const className = `ark-condition ${check.met === undefined ? '' : check.met ? 'met' : 'unmet'}`;
    const content = <><ArkIcon name={check.icon} assets={assets} /><b>{check.value}</b>{check.met !== undefined && <small aria-hidden="true">{check.met ? '✓' : '×'}</small>}</>;
    return interactive ? <ArkHint key={check.icon} label={label} detail={check.detail} className={className} testId={`requirement-${check.icon}`} onReveal={() => guide?.reveal(check.focus)} onDismiss={() => guide?.clear(check.focus.id)}>{content}</ArkHint>
      : <span className={className} key={check.icon} title={check.title} aria-label={label} onMouseEnter={() => guide?.reveal(check.focus)} onMouseLeave={() => guide?.clear(check.focus.id)}>{content}</span>;
  })}{!checks.length && <span className="tiny">无前置图标</span>}</div>;
}
