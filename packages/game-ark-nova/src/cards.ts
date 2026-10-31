export const CONTINENTS = ['africa', 'americas', 'australia', 'asia', 'europe'] as const;
export const ANIMAL_TAGS = ['predator', 'herbivore', 'primate', 'reptile', 'bird', 'bear', 'pet'] as const;
export const TAG_NAMES: Record<string, string> = {
  africa: '非洲', americas: '美洲', australia: '澳洲', asia: '亚洲', europe: '欧洲',
  predator: '食肉类', herbivore: '食草类', primate: '灵长类', reptile: '爬行类', bird: '鸟类', bear: '熊类', pet: '萌宠', science: '研究',
  water: '水域', rock: '岩石', 'all-animals': '不同动物类目', 'all-continents': '不同大洲'
};
export interface Ability { key: string; value: number | string }
export interface ZooCard {
  id: string;
  name: string;
  kind: 'animal' | 'sponsor';
  size: number;
  price: number;
  appeal: number;
  conservation: number;
  reputation: number;
  rock: number;
  water: number;
  tags: string[];
  requirements: string[];
  abilities: Ability[];
  strength: number;
}
type AnimalRow = [string, string, number, number, number, number, number, number, number, string[], string[], [string, number | string][]];
const animalRows: AnimalRow[] = [
  ['401','猎豹',5,17,6,0,0,0,0,['predator','predator','africa'],[],[['SPRINT',3]]],
  ['402','狮子',4,16,9,0,0,0,0,['predator','africa'],['predator','predator','predator'],[['PACK',1]]],
  ['403','花豹',3,20,7,1,0,1,0,['predator','africa'],['Partner Zoo'],[['HUNTER',4]]],
  ['404','狞猫',2,9,4,0,0,0,0,['predator','africa'],[],[['HUNTER',2]]],
  ['405','耳廓狐',1,8,3,0,0,0,0,['predator','africa'],[],[['CLEVER',1]]],
  ['406','西伯利亚虎',5,30,10,2,1,0,0,['predator','asia'],['asia','asia','asia'],[]],
  ['407','苏门答腊虎',4,26,8,2,1,0,2,['predator','asia'],['science','science'],[]],
  ['410','黄喉貂',1,7,3,0,0,0,0,['predator','asia'],[],[['HUNTER',1]]],
  ['411','灰棕熊',5,22,9,0,0,0,0,['predator','bear','americas'],['predator','predator','animalsII'],[['INVENTIVE_BEAR',1],['FULL_THROATED',1]]],
  ['412','美洲豹',4,16,8,0,0,0,0,['predator','americas'],['americas'],[['HUNTER',4]]],
  ['413','美洲狮',3,10,5,0,0,1,0,['predator','americas'],[],[['JUMPING',3]]],
  ['414','南浣熊',2,11,4,0,0,1,0,['predator','bear','americas'],[],[['INVENTIVE',1]]],
  ['417','狼',4,12,4,0,0,0,0,['predator','europe'],[],[['PACK',1]]],
  ['418','猞猁',3,11,2,0,0,0,0,['predator','europe'],['europe','europe'],[['ICONIC_ANIMAL','europe']]],
  ['420','白鼬',1,4,3,0,0,0,0,['predator','europe'],['europe'],[['HUNTER',1]]],
  ['421','新澳海狗',5,17,8,0,0,1,1,['predator','australia'],['animalsII'],[['FULL_THROATED',1]]],
  ['422','澳海狮',4,18,7,1,0,0,1,['predator','australia'],['Partner Zoo'],[['SUN_BATHING',3]]],
  ['423','新西兰海狮',3,17,6,0,0,0,1,['predator','australia'],[],[['PACK',1]]],
  ['424','澳洲野犬',2,13,3,0,0,0,0,['predator','australia'],[],[['PACK',1]]],
  ['425','袋獾',1,11,4,0,1,0,0,['predator','australia'],['science'],[['POUCH',1]]],
  ['433','大熊猫',3,27,10,2,1,0,0,['herbivore','bear','asia'],['herbivore','bear','Partner Zoo'],[]],
  ['436','美洲野牛',5,18,4,0,0,0,0,['herbivore','americas','americas'],['americas','americas','americas'],[['ICONIC_ANIMAL','americas']]],
  ['437','麝牛',4,13,5,0,0,0,0,['herbivore','americas'],['americas'],[['SPONSOR_MAGNET',1]]],
  ['441','欧洲野牛',5,19,6,0,0,0,0,['herbivore','europe','europe'],['Partner Zoo'],[['SPONSOR_MAGNET',1]]],
  ['444','羱羊',2,10,5,0,0,2,0,['herbivore','europe'],[],[['JUMPING',2]]],
  ['448','树袋熊',3,21,8,0,1,1,0,['herbivore','bear','australia'],['australia'],[['POUCH',2]]],
  ['450','塔斯马尼亚袋熊',2,9,4,0,0,0,0,['herbivore','australia'],[],[['POUCH',1]]],
  ['452','塞内加尔婴猴',1,10,1,0,0,0,0,['primate','africa'],['africa','africa'],[['ICONIC_ANIMAL','africa']]],
  ['454','环尾狐猴',3,12,6,0,0,1,0,['primate','africa'],[],[['SUN_BATHING',3]]],
  ['455','东非黑白疣猴',3,13,6,0,0,0,0,['primate','africa'],[],[['CLEVER',1]]],
  ['459','红腿白臀叶猴',4,17,7,0,1,0,0,['primate','asia'],['science'],[['INVENTIVE_PRIMARY',1]]],
  ['460','郁乌叶猴',2,12,5,0,0,0,0,['primate','asia'],[],[['CLEVER',1]]],
  ['461','邦加跗猴',1,14,3,0,2,0,0,['primate','asia'],['Partner Zoo'],[['JUMPING',4]]],
  ['462','印度灰叶猴',3,13,6,0,0,1,0,['primate','asia'],[],[['JUMPING',3]]],
  ['465','金狮面狨',1,10,4,0,0,0,0,['primate','americas'],[],[['CLEVER',1]]],
  ['467','厄瓜多尔松鼠猴',2,12,5,0,0,0,0,['primate','americas'],[],[['CLEVER',1]]],
  ['468','绒顶柽柳猴',1,15,4,1,1,0,0,['primate','americas'],['science','science'],[]],
  ['469','尼罗鳄',5,13,9,0,0,0,1,['reptile','africa'],['reptile','reptile','reptile'],[['SNAPPING_2',1]]],
  ['471','苏卡达陆龟',3,22,6,1,0,0,0,['reptile','africa'],[],[['SUN_BATHING',3]]],
  ['472','岩巨蜥',2,12,5,0,0,1,0,['reptile','africa'],[],[['SUN_BATHING',3]]],
  ['473','彩虹飞蜥',1,9,3,0,0,0,0,['reptile','africa'],[],[['SUN_BATHING',2]]],
  ['476','科莫多巨蜥',3,14,2,0,0,0,0,['reptile','asia'],['asia','asia'],[['ICONIC_ANIMAL','asia']]],
  ['477','高冠变色龙',1,14,4,0,0,0,0,['reptile','asia'],[],[['SNAPPING_1',1]]],
  ['478','长鬣蜥',1,8,3,0,0,0,1,['reptile','asia'],[],[['SUN_BATHING',2]]],
  ['479','美洲短吻鳄',4,18,7,0,0,0,1,['reptile','americas'],[],[['SNAPPING_1',1]]],
  ['480','宽吻凯门鳄',4,16,6,0,0,0,1,['reptile','americas'],[],[['SNAPPING_1',1]]],
  ['481','加拉帕戈斯象龟',3,30,8,2,1,0,0,['reptile','americas'],['americas','americas','animalsII'],[['SUN_BATHING',4]]],
  ['484','欧洲泽龟',1,9,4,0,0,0,1,['reptile','europe'],[],[]],
  ['486','普通壁蜥',1,4,2,0,0,1,0,['reptile','europe'],[],[]],
  ['487','领纹蛇',1,8,3,0,0,0,1,['reptile','europe'],[],[['CLEVER',1]]],
  ['488','蛇蜥',1,4,2,0,0,0,1,['reptile','europe'],[],[]],
  ['489','湾鳄',5,23,9,0,0,0,1,['reptile','reptile','australia'],['Partner Zoo'],[['SNAPPING_2',1]]],
  ['490','砂巨蜥',3,15,6,0,0,0,0,['reptile','australia'],[],[['SCAVENGING',2]]],
  ['491','伞蜥',2,12,5,0,0,1,0,['reptile','australia'],[],[['SPRINT',1]]],
  ['493','棘蜥',1,6,3,0,0,1,0,['reptile','australia'],[],[]],
  ['494','非洲鸵鸟',5,20,8,0,0,0,0,['bird','africa'],[],[['SPRINT',2]]],
  ['495','蛇鹫',4,14,4,1,0,0,0,['bird','africa'],[],[]],
  ['496','秃鹳',3,10,4,0,0,0,0,['bird','africa'],[],[['SCAVENGING',2]]],
  ['498','鲸头鹳',1,9,3,1,0,0,0,['bird','africa'],['science','science'],[]],
  ['499','秃鹫',5,16,6,0,0,0,0,['bird','asia'],[],[['SCAVENGING',3]]],
  ['500','长喙兀鹫',4,20,5,1,1,1,0,['bird','asia'],['science'],[['SCAVENGING',3]]],
  ['503','雪鸮',1,11,4,0,1,0,0,['bird','asia'],['bird','bird'],[['PERCEPTION_4',1]]],
  ['504','安第斯神鹫',5,17,7,0,1,1,0,['bird','americas'],['bird'],[['SCAVENGING',4]]],
  ['506','王鹫',3,12,9,0,0,0,0,['bird','americas'],['bird','bird','bird'],[['SCAVENGING',5]]],
  ['507','大美洲鸵',2,12,5,0,0,0,0,['bird','americas'],[],[['SPRINT',1]]],
  ['512','雕鸮',2,10,4,0,0,0,0,['bird','europe'],['Partner Zoo'],[['PERCEPTION_4',1]]],
  ['513','仓鸮',1,12,3,0,0,0,0,['bird','europe'],[],[['PERCEPTION_4',1]]],
  ['517','笑翠鸟',2,9,0,0,0,0,0,['bird','australia'],['australia'],[['ICONIC_ANIMAL','australia']]],
  ['519','家山羊',1,7,0,0,0,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['520','绵羊',1,7,0,0,0,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['521','马',1,7,0,0,1,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['522','驴',1,7,0,0,0,0,0,['pet'],[],[['INVENTIVE',1],['PETTING_ZOO_ANIMAL',1]]],
  ['523','家兔',1,7,0,0,0,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['525','豚鼠',1,7,0,0,0,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['526','羊驼',1,7,0,0,0,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['527','虹彩吸蜜鹦鹉',1,7,0,0,0,0,0,['pet'],[],[['PETTING_ZOO_ANIMAL',1]]],
  ['528','红颈袋鼠',1,7,0,0,0,0,0,['pet'],[],[['POUCH',1],['PETTING_ZOO_ANIMAL',1]]]
];
const sponsorRows: [string, string, number, string[], string[], number][] = [
  ['203','兽医',4,['science'],[],0], ['209','技术研究所',5,['science'],[],0],
  ['220','联邦资助金',4,['science'],[],0], ['225','检疫实验室',3,['science'],[],0],
  ['226','海外研究所',6,['science'],[],2], ['229','小型动物专家',5,[],[],0], ['230','大型动物专家',4,[],[],0],
  ['231','灵长类资助计划',3,[],['primate'],0], ['232','爬行类资助计划',3,[],['reptile'],0],
  ['233','鸟类资助计划',3,[],['bird'],0], ['234','食肉类资助计划',3,[],['predator'],0],
  ['235','食草类资助计划',3,[],['herbivore'],0],
  ['236','灵长类动物学家',4,['primate'],[],0], ['237','爬行类动物学家',4,['reptile'],[],0],
  ['238','鸟类学家',4,['bird'],[],0], ['239','食肉动物专家',4,['predator'],[],0],
  ['240','食草动物专家',4,['herbivore'],[],0], ['261','导游学校参观',3,[],[],0]
];
export const ZOO_CARDS: ZooCard[] = [
  ...animalRows.map(([id, name, size, price, appeal, conservation, reputation, rock, water, tags, requirements, abilities]): ZooCard =>
    ({ id, name, kind: 'animal', size, price, appeal, conservation, reputation, rock, water, tags, requirements, abilities: abilities.map(([key, value]) => ({ key, value })), strength: 0 })),
  ...sponsorRows.map(([id, name, strength, tags, requirements, reputation]): ZooCard => ({
    id, name, kind: 'sponsor', strength, tags, requirements, reputation,
    size: 0, price: 0, appeal: 0, conservation: 0, rock: 0, water: 0, abilities: []
  }))
];
export const CARD_IDS = ZOO_CARDS.map(card => card.id);
const byId = new Map(ZOO_CARDS.map(card => [card.id, card]));
export function zooCard(id: string): ZooCard {
  const card = byId.get(id);
  if (!card) throw new Error(`卡牌 ${id} 不在首版已实现牌池中。`);
  return card;
}

export const ABILITY_LABELS: Record<string, string> = {
  SPRINT: '冲刺：从牌库抽牌', PACK: '群体：每个食肉图标获得 1 魅力', HUNTER: '狩猎：展示牌库并选择一张动物',
  CLEVER: '机灵：行动完成后移动一张行动卡至槽位 1', JUMPING: '跳跃：推进休息并获得等量资金',
  INVENTIVE: '创新：获得 X 标记', INVENTIVE_BEAR: '所有动物园每个熊图标获得 X，最多 3 枚',
  INVENTIVE_PRIMARY: '按灵长类图标获得 1/2/3 枚 X', ICONIC_ANIMAL: '标志动物：按所有动物园的大洲图标获得魅力，最多 8',
  SUN_BATHING: '日光浴：可卖出手牌，每张获得 4 资金', POUCH: '育儿袋：可将手牌置于本卡下，每张获得 2 魅力',
  SPONSOR_MAGNET: '赞助商磁石：获得展示区全部赞助商', SNAPPING_1: '精选 1 张展示牌', SNAPPING_2: '精选 2 张展示牌，可在两次间补牌',
  PERCEPTION_4: '洞察：抽 4 张保留 2 张', SCAVENGING: '食腐：洗混弃牌，抽取后保留 1 张', PETTING_ZOO_ANIMAL: '按萌宠图标获得 3 倍魅力',
  FULL_THROATED: '呼唤：解锁一个事务员'
};
export function sponsorDescription(id: string): string {
  if (id === '203') return '支持保护项目所需协会强度降至 4。';
  if (id === '209') return '每次休息获得 1 枚 X 标记。';
  if (id === '220') return '每次休息获得 3 资金。';
  if (id === '225') return '免疫毒液、缠绕、催眠、偷窃；终局集齐 5 大洲获得 1 保护。此牌池不包含这些攻击效果。';
  if (id === '226') return '立即获得 2 声望；终局集齐 5 大洲获得 1 保护。';
  if (id === '229') return '安置面积 1–2 的小型动物费用减少 3。';
  if (id === '230') return '安置面积 4–5 的大型动物费用减少 4。';
  if (Number(id) >= 231 && Number(id) <= 235) return '打出时每个对应动物图标获得 1 魅力；休息时有 1/3/5 个图标获得 3/6/9 资金。';
  if (Number(id) >= 236 && Number(id) <= 240) return '每次任何动物园打出对应动物图标时，每个图标获得 3 资金。包括本卡自身图标。';
  return '终局集齐 5 种不同动物类目，获得 1 保护。';
}
export interface Project { id: string; name: string; tag: string; thresholds: number[]; points: number[] }
export const BASE_PROJECTS: Project[] = [
  { id: '101', name: '物种多样性', tag: 'all-animals', thresholds: [5, 4, 3], points: [5, 3, 2] },
  { id: '102', name: '栖息地多样性', tag: 'all-continents', thresholds: [5, 4, 3], points: [5, 3, 2] },
  ...CONTINENTS.map((tag, index) => ({ id: String(103 + index), name: TAG_NAMES[tag]!, tag, thresholds: [5, 4, 2], points: tag === 'australia' || tag === 'europe' ? [5, 4, 2] : [5, 3, 2] })),
  ...['primate', 'reptile', 'predator', 'herbivore', 'bird'].map((tag, index) => ({ id: String(108 + index), name: TAG_NAMES[tag]!, tag, thresholds: [5, 4, 2], points: [5, 4, 2] }))
];
export const FINAL_CARDS = [
  { id: '001', name: '大型动物公园', metric: 'large', thresholds: [1, 2, 4, 5] },
  { id: '002', name: '小型动物公园', metric: 'small', thresholds: [3, 6, 8, 10] },
  { id: '003', name: '科研动物园', metric: 'science', thresholds: [3, 4, 5, 6] },
  { id: '004', name: '主题建筑动物园', metric: 'architecture', thresholds: [] },
  { id: '005', name: '公益保护动物园', metric: 'projects', thresholds: [3, 4, 5, 6] },
  { id: '006', name: '自然动物园', metric: 'empty', thresholds: [6, 12, 18, 24] },
  { id: '007', name: '人气动物园', metric: 'reputation', thresholds: [6, 9, 12, 15] },
  { id: '008', name: '慈善动物园', metric: 'sponsors', thresholds: [3, 6, 8, 10] },
  { id: '009', name: '综合物种动物园', metric: 'diversity', thresholds: [] },
  { id: '010', name: '岩石公园', metric: 'rock', thresholds: [1, 3, 5, 7] },
  { id: '011', name: '水生态公园', metric: 'water', thresholds: [2, 4, 6, 8] }
];
export const ARK_LIMITATIONS = [
  '首版仅地图 A、双人、已实现动物与赞助商牌池；不含 20 张牌库保护项目。',
  '鸟禽馆、爬行馆、额外行动、双重/毒液/缠绕及其他未入池能力尚未开放。',
  '保护 5/8 点的奖励使用公开固定教学配置；完整随机奖励池后续补齐。'
];
