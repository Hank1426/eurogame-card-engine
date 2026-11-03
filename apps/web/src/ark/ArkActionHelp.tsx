import { ACTION_NAMES, animalCapacity, availableWorkers, cardActionTable, reputationRange, type ArkAction, type ArkPlayer, type ArkView } from '@eurogame/game-ark-nova';
import type { ReactNode } from 'react';
import { ArkHint } from './ArkHint.js';
import { useArkGuide } from './ArkGuide.js';

export function actionExplanation(action: ArkAction, strength: number, upgraded: boolean, player: ArkPlayer): string[] {
  if (strength < 1) return ['缠绕后强度不足 1，须增加 X 或改拿 X。'];
  if (action === 'animals') return [
    `最多安置 ${animalCapacity(strength, upgraded)} 只动物${!upgraded && strength < 2 ? '（I 面至少需要强度 2）' : ''}。`,
    upgraded ? `可从手牌或声望范围 ${reputationRange(strength >= 5 ? Math.min(player.upgrades.includes('cards') ? 15 : 9, player.reputation + 1) : player.reputation)} 格内的展示区打出。${strength >= 5 ? '先获得 1 声望，再检查动物条件；范围已计入此奖励。' : ''}` : '只能从手牌打出。',
    '动物逐只处理，支付费用并检查图标、饲养区和地形。'
  ];
  if (action === 'cards') {
    const table = cardActionTable(strength, upgraded);
    return [`抓 ${table.draw} 张，再弃 ${table.discard} 张；休息进度 +2。`, table.snap ? '也可改为精选任意 1 张展示牌，不能与普通抓牌混用。' : `精选需要强度 ${upgraded ? 3 : 5}。`, upgraded ? `普通抓牌可从声望范围 ${reputationRange(player.reputation)} 格内拿取。` : '普通抓牌只从牌库获取。'];
  }
  if (action === 'build') return [`${upgraded ? '多座不同类型建筑的总面积' : '一座建筑的面积'}不超过 ${strength} 格，每格支付 2 资金。`, upgraded ? '可用 II 限制格，并可建鸟禽馆、爬行馆（各 5 格）。' : '不能覆盖 II 限制格；特殊馆需要建造 II。', '仍受资金、供应、地形、邻接和建筑距离约束。'];
  if (action === 'sponsors') return [upgraded ? `可打出多张赞助商，总等级不超过 ${strength + 1}。` : `打出 1 张等级不超过 ${strength} 的手牌赞助商。`, `也可推进 ${strength} 格休息，获得 ${strength * (upgraded ? 2 : 1)} 资金。`, upgraded ? '可付展示位费用，从声望范围内打出；不能打牌后再选拿钱。' : '打牌与拿钱二选一。'];
  return [
    `任务强度：声望 +2 需 2；合作动物园需 3；大学需 4；保护项目需 ${player.sponsors.includes('203') ? 4 : 5}。`,
    upgraded ? `可组合不同任务，总强度不超过 ${strength}，完成任务后可额外捐赠。` : '每次只能执行一项任务。',
    `可用事务员 ${availableWorkers(player)}/${player.workers}；同次休息前重复同类任务需 2 人。`
  ];
}

export function ArkActionHelp({ action, player, view, spendX, doubles, reason, children }: {
  action: ArkAction; player: ArkPlayer; view: ArkView; spendX: number; doubles: number; reason?: string | undefined; children: ReactNode;
}) {
  const guide = useArkGuide();
  const context = view.context?.action === action ? view.context : null;
  const slot = player.row.indexOf(action) + 1;
  const penalty = view.constriction[player.id]?.includes(action) ? 2 : 0;
  const strength = context?.strength ?? slot + spendX - penalty;
  const upgraded = context?.upgraded ?? player.upgrades.includes(action);
  const linked = guide?.focus?.kind === 'icon' && guide.linkedTags.includes(`${action}II`);
  return <ArkHint label={`${ACTION_NAMES[action]}行动说明 · 强度 ${strength}`} className={`ark-action-help ${linked ? 'guide-linked' : ''}`} testId={`action-help-${action}`} width={420} interactiveTooltip={false} detail={<div className="ark-action-help-content">
    <p className="ark-strength-formula">{context ? `本次强度 ${strength} · 已消耗 ${context.spentX} X · 剩余额度 ${context.remaining}` : `槽位 ${slot} + ${spendX} X${penalty ? ' − 缠绕 2' : ''} = 强度 ${strength}`}</p>
    <div className="ark-action-comparison">{[false, true].map(side => <section className={side === upgraded ? 'current-side' : ''} key={String(side)}><h3>{ACTION_NAMES[action]} {side ? 'II' : 'I'}{side === upgraded ? ' · 当前' : side ? ' · 升级后' : ''}</h3>{actionExplanation(action, strength, side, player).map(line => <p key={line}>{line}</p>)}</section>)}</div>
    {doubles > 0 && <p>消耗 {doubles} 枚双重可先后执行 {doubles + 1} 次；X 只增强当次，后续 X 单独支付。</p>}
    {view.venom[player.id]?.includes(action) && <p>执行这张卡可移除其毒液；回合末仍有毒液时，逐枚支付 2 资金。</p>}
    {reason && !context && <p className="ark-action-unavailable">当前不能开始：{reason}</p>}
    <small>说明不会开始行动或消耗 X。可以改拿 X；行动完成后，卡片移到槽位 1。</small>
  </div>}>{children}</ArkHint>;
}
