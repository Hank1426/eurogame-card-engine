import { projectMetric, TAG_NAMES, type ArkPlayer } from '@eurogame/game-ark-nova';
import type { ReactNode } from 'react';
import { ArkHint } from './ArkHint.js';
import { useArkGuide } from './ArkGuide.js';
import { iconSources } from './guide-model.js';

export function ArkProjectCheck({ id, tag, needed, player, blocked = false, claimed, children, className = '' }: {
  id: string; tag: string; needed: number; player: ArkPlayer; blocked?: boolean; claimed?: string | null; children: ReactNode; className?: string;
}) {
  const guide = useArkGuide();
  const actual = projectMetric(player, tag);
  const focus = { id: `project-${id}-${needed}`, kind: 'icon' as const, key: tag };
  const sources = iconSources(player, tag);
  const label = `${TAG_NAMES[tag] ?? tag} · 需要 ${needed} · 已有 ${actual} · ${actual >= needed ? '图标已满足' : `还缺 ${needed - actual}`}`;
  return <ArkHint label={label} className={`ark-project-check ${className}`} testId={`project-check-${id}-${needed}`} onReveal={() => guide?.reveal(focus)} onDismiss={() => guide?.clear(focus.id)} detail={<>
    <p>{label}</p>{blocked ? <p>此等级在双人设置中封锁。</p> : claimed ? <p>{claimed === player.id ? '你' : '对手'}已支持此等级。</p> : <p>仍需检查协会强度、事务员和同项目支持限制。</p>}
    {sources.map((source, index) => <p key={index}>{source.label}<b>×{source.count}</b></p>)}
    <small>{tag === 'all-animals' || tag === 'all-continents' ? '此项目统计不同种类，同类多个图标只算一种。' : '只统计已入园的公开来源；手牌不计入。'}{tag === 'water' || tag === 'rock' ? '这里统计卡面图标，与地图地形格数量不同。' : ''}</small>
  </>}>{children}</ArkHint>;
}
