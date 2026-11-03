import { ACTION_NAMES, ANIMAL_TAGS, CONTINENTS, TAG_NAMES, UNIVERSITY_NAMES, availableWorkers, breakIncome, tagsOf, type ArkView } from '@eurogame/game-ark-nova';
import { ArkIcon, ICON_NAMES } from './ArkIcon.js';
import { ArkHint } from './ArkHint.js';
import { useResourceChanges } from './table-motion.js';
import { useArkGuide } from './ArkGuide.js';
import { iconSources } from './guide-model.js';

const TAG_ORDER = [...CONTINENTS, 'science', 'water', 'rock', ...ANIMAL_TAGS];
function PlayerSummary({ player, actor, assets, onObserve, observing }: { player: ArkView['players'][number]; actor: string; assets: Record<string, string>; onObserve: (id: string) => void; observing: string | null }) {
  const income = breakIncome(player);
  const tags = tagsOf(player);
  const guide = useArkGuide();
  const changes = useResourceChanges({ money: player.money, appeal: player.appeal, conservation: player.conservation, reputation: player.reputation, x: player.x });
  const metrics = [
    { name: 'money', value: player.money, detail: '当前可支付资金。', testId: player.id === 'p1' ? 'ark-money' : 'ark-ai-money' },
    { name: 'income', value: income.money, detail: <>{income.sources.map(source => <p key={source.label}>{source.label}<b>+{source.amount}</b></p>)}<p>合计资金<b>+{income.money}</b></p>{income.conservation > 0 && <p>保护点<b>+{income.conservation}</b></p>}{income.x > 0 && <p>X 标记<b>+{income.x}</b></p>}{income.snap && <p>精选 1 张展示牌</p>}{income.rangeSnap && <p>可选：声望范围内精选 1 张</p>}{income.paidSponsor && <p>可按等级付费打出赞助商</p>}<small>按当前园区估算下次休息；选择所得的后续收益未计入。</small></> },
    { name: 'appeal', value: player.appeal, detail: '魅力提高休息收入，与保护轨道交会触发终局。' },
    { name: 'conservation', value: player.conservation, detail: '支持保护项目等获得保护点；与魅力轨道交会触发终局。' },
    { name: 'reputation', value: player.reputation, detail: '决定展示区可达范围，并解锁声望轨道奖励。' },
    { name: 'x', value: player.x, detail: '开始行动前，每消耗 1 枚 X 增加强度 1，最多持有 5 枚。' },
    { name: 'worker', value: `${availableWorkers(player)}/${player.workers}`, detail: '可用 / 已解锁事务员。休息恢复全部已解锁事务员。' },
    { name: 'cards', value: player.handCount, detail: `手牌数量；休息上限 ${player.universities.includes('hand') ? 5 : 3}。${player.id === 'p1' ? '' : '对手手牌内容保持隐藏。'}` }
  ];
  return <article className={`ark-player-summary ${player.id} ${actor === player.id ? 'active' : ''}`} aria-label={`${player.id === 'p1' ? '你' : 'AI'}的公开信息`} data-testid={`ark-player-${player.id}`}>
    <header><ArkHint label={player.name} detail={<><p>地图 {player.map} · {actor === player.id ? '正在行动' : '等待行动'}</p><p>行动槽位（左 → 右）</p>{player.row.map((action, index) => <p key={action}>{index + 1} · {ACTION_NAMES[action]} {player.upgrades.includes(action) ? 'II' : 'I'}</p>)}<small>合作动物园：{player.partners.map(tag => TAG_NAMES[tag]).join('、') || '无'}<br />{player.universities.map(id => UNIVERSITY_NAMES[id]).join('；') || '大学：无'}</small></>}><span className="ark-player-dot" /><strong>{player.id === 'p1' ? '你的动物园' : '林野 AI'}</strong></ArkHint><button type="button" className="ark-observe-button" aria-label={player.id === 'p1' ? '返回我的园区' : '观察 AI 园区'} aria-pressed={player.id === 'p1' ? observing === null : observing === player.id} onClick={() => onObserve(player.id)}>{player.id === 'p1' ? '⌂ 我的园区' : '◎ 观察园区'}</button></header>
    <div className="ark-player-metrics">{metrics.map(({ name, value, detail, testId }, index) => <ArkHint key={name} label={`${ICON_NAMES[name] ?? name} ${value}`} detail={detail} className={`${index < 4 ? 'primary-metric' : 'secondary-metric'} ${player.id === 'p1' && guide?.focus?.kind === 'icon' && guide.linkedTags.includes(name) ? 'guide-linked' : ''}`} testId={`${player.id}-${name}`}>
      <ArkIcon name={name} assets={assets} /><b data-testid={testId}>{value}{name === 'money' && player.id === 'p1' ? ' ◈' : ''}</b>
      {name === 'income' && <span className="ark-income-cycle" aria-hidden="true">↻</span>}
      {changes[name] !== undefined && <small className={`ark-resource-delta ${changes[name]! < 0 ? 'negative' : ''}`} aria-hidden="true">{changes[name]! > 0 ? '+' : ''}{changes[name]}</small>}
    </ArkHint>)}</div>
    <div className="ark-player-tags" aria-label="公开图标数量">{TAG_ORDER.map(tag => {
      const count = tags[tag] ?? 0;
      const sources = iconSources(player, tag);
      const focus = { id: `summary-${player.id}-${tag}`, kind: 'icon' as const, key: tag };
      return <ArkHint key={tag} label={`${TAG_NAMES[tag]}图标 ${count}`} className={`ark-tag-count ${count ? '' : 'empty'} ${player.id === 'p1' && guide?.focus?.kind === 'icon' && guide.linkedTags.includes(tag) ? 'guide-linked' : ''}`} testId={`${player.id}-tag-${tag}`} onReveal={() => { if (player.id === 'p1') guide?.reveal(focus); }} onDismiss={() => guide?.clear(focus.id)} detail={<>{sources.map((source, index) => <p key={index}>{source.label} ×{source.count}</p>)}{!count && <p>尚未获得此图标。</p>}<small>{tag === 'water' || tag === 'rock' ? '统计卡面图标，不代表地图上的地形格数量。' : '只统计已入园卡牌、合作动物园和大学；手牌不计入。'}</small></>}><ArkIcon name={tag} assets={assets} /><b>{count}</b></ArkHint>;
    })}</div>
  </article>;
}

export function ArkPlayers({ view, assets, onObserve, observing }: { view: ArkView; assets: Record<string, string>; onObserve: (id: string) => void; observing: string | null }) {
  return <section className="ark-players" aria-label="双方公开信息">{view.players.map(player => <PlayerSummary key={player.id} player={player} actor={view.actor} assets={assets} onObserve={onObserve} observing={observing} />)}</section>;
}
