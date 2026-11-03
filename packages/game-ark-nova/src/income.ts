import { appealIncome, kioskIncome } from './board.js';
import { zooCard } from './cards.js';
import { tagsOf } from './rules.js';
import { sideEntranceIncome } from './sponsor-metrics.js';
import type { ArkPlayer } from './types.js';

export const FUNDING_TAGS: Record<string, string> = { '231': 'primate', '232': 'reptile', '233': 'bird', '234': 'predator', '235': 'herbivore' };

/** Current public income, shared by settlement and the table preview. */
export function breakIncome(player: ArkPlayer) {
  const tags = tagsOf(player);
  const sources = [
    { label: '魅力收入', amount: appealIncome(player.appeal) },
    { label: '贩售亭', amount: kioskIncome(player.buildings) },
    { label: zooCard('257').name, amount: sideEntranceIncome(player) },
    { label: '保护项目奖励', amount: player.projectRewards.includes('income-5') ? 5 : 0 },
    { label: zooCard('220').name, amount: player.sponsors.includes('220') ? 3 : 0 },
    ...player.sponsors.filter(id => FUNDING_TAGS[id]).map(id => {
      const count = tags[FUNDING_TAGS[id]!] ?? 0;
      return { label: zooCard(id).name, amount: count >= 5 ? 9 : count >= 3 ? 6 : count >= 1 ? 3 : 0 };
    })
  ].filter(source => source.amount > 0);
  return {
    money: sources.reduce((total, source) => total + source.amount, 0), sources,
    conservation: Number(player.projectRewards.includes('income-cp')) + Number(player.sponsors.includes('206')),
    x: Number(player.sponsors.includes('209')),
    snap: player.projectRewards.includes('snap'),
    rangeSnap: player.sponsors.includes('201'),
    paidSponsor: player.projectRewards.includes('income-sponsor')
  };
}
