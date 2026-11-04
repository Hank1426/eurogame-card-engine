import type { GameDescriptor } from './types.js';

// Metadata only: browsing the lobby does not load rules, decks or AI modules.
export const GAMES: GameDescriptor[] = [
  { id: 'garden-lab', name: '植序工坊', category: '原创 · 引擎样例', symbol: '⌁', art: 'botanical', status: '可立即游玩',
    description: '经营微型生态工坊，用卡牌、资源与持续收入，培育自己的得分引擎。', playerCounts: [2, 3, 4],
    brief: '每轮每人行动一次。第 6 轮收入结算后，得分最高者获胜；同分并列。', rulesRoute: 'rules', tableRoute: 'table',
    load: async () => (await import('../games/demo-adapter.js')).demoAdapter },
  { id: 'ark-nova', name: '方舟动物园', category: '德式卡牌 · 基础全牌库', symbol: '⬡', art: 'symbol', status: '基础全牌库 · 实验验收中',
    description: '使用 128 张动物与 64 张赞助商，体验群居、互动、独有建筑与保护项目。', playerCounts: [2],
    brief: '五行动强度由槽位决定，没有固定轮数。魅力与保护交会后进入最后回合，再结算终局目标。基础 235 张内容已接入，逐卡人工复核与完整试玩仍单独验收。', rulesRoute: 'ark-rules', tableRoute: 'ark',
    maps: [
      { id: 'A', name: '教学地图 A', description: '预置贩售亭与 3 格饲养区。' },
      { id: '0', name: '基础地图 0', description: '空白起步，首座建筑必须覆盖边界。' },
      { id: '1', name: '观测塔', description: '邻接观测塔的标准饲养区安置动物获得额外魅力。' },
      { id: '2', name: '户外营地', description: '邻接户外营地的标准饲养区容量增加 2。' }
    ], load: async () => (await import('../games/ark-adapter.js')).arkAdapter }
];
export function gameById(id: string): GameDescriptor {
  const game = GAMES.find(game => game.id === id);
  if (!game) throw new Error(`未知游戏：${id}。请保留原始文件。`);
  return game;
}
export async function restoreGame(text: string) {
  if (text.length > 5_000_000) throw new Error('存档超过 5 MB 上限。');
  const metadata: unknown = JSON.parse(text);
  const id = (metadata as { manifest?: { gameId?: unknown } } | null)?.manifest?.gameId;
  if (typeof id !== 'string') throw new Error('存档缺少游戏 ID。');
  return (await gameById(id).load()).restore(text);
}
