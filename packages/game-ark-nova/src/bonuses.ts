export const BONUS_TILES = ['reputation-2', 'x-3', 'free-3', 'draw-3', 'money-10', 'double-token', 'university', 'partner-zoo', 'sponsor-money'] as const;
export const BONUS_NAMES: Record<string, string> = {
  'reputation-2': '获得 2 声望', 'x-3': '获得 3 枚 X', 'free-3': '免费建造 3 格饲养区',
  'draw-3': '从牌库或声望范围依次拿取 3 张牌', 'money-10': '获得 10 资金',
  'double-token': '在一张行动卡上放置双重标记', university: '拿取一个可用大学',
  'partner-zoo': '拿取一个可用合作动物园', 'sponsor-money': '支付等于等级的资金，打出一张手牌赞助商'
};
