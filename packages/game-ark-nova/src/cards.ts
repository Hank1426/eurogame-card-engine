export const CONTINENTS = ['africa', 'americas', 'australia', 'asia', 'europe'] as const;
export const ANIMAL_TAGS = ['predator', 'herbivore', 'primate', 'reptile', 'bird', 'bear', 'pet'] as const;
export const TAG_NAMES: Record<string, string> = {
  africa: '非洲', americas: '美洲', australia: '澳洲', asia: '亚洲', europe: '欧洲',
  predator: '食肉类', herbivore: '食草类', primate: '灵长类', reptile: '爬行类', bird: '鸟类', bear: '熊类', pet: '萌宠', science: '研究',
  water: '水域', rock: '岩石', 'all-animals': '不同动物类目', 'all-continents': '不同大洲',
  'animal-size-2': '小型动物', 'animal-size-4': '大型动物'
};
export interface Ability { key: string; value: number | string }
export interface ZooCard {
  id: string;
  name: string;
  kind: 'animal' | 'sponsor' | 'project';
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
  specialHousing?: { kind: 'reptile-house' | 'aviary'; space: number };
}
type AnimalRow = [string, string, number, number, number, number, number, number, number, string[], string[], [string, number | string][]];
const animalRows: AnimalRow[] = [
  ['464','棕蜘蛛猴',4,17,6,1,0,0,0,['primate','americas'],['primate'],[['INVENTIVE_PRIMARY',1]]],
  ['449','鸭嘴兽',2,10,4,0,0,0,1,['herbivore','australia'],[],[['VENOM',1]]],
  ['456','地中海猕猴',2,13,6,0,0,0,0,['primate','africa'],['Partner Zoo'],[['PILFERING_1',1]]],
  ['458','日本猕猴',3,18,7,0,0,0,1,['primate','asia'],['asia'],[['PILFERING_2',1]]],
  ['463','巴拿马白面卷尾猴',2,11,5,0,0,0,0,['primate','americas'],['Partner Zoo'],[['PILFERING_1',1]]],
  ['470','西部绿曼巴蛇',2,13,6,0,0,0,0,['reptile','africa'],['africa','reptile'],[['VENOM',2]]],
  ['474','印度蟒',2,14,7,0,0,0,0,['reptile','asia'],['reptile','reptile'],[['CONSTRICTION',1]]],
  ['475','眼镜王蛇',2,13,6,0,0,0,0,['reptile','asia'],['science','science','animalsII'],[['HYPNOSIS',3]]],
  ['482','亚马逊森蚺',2,13,6,0,0,0,0,['reptile','americas'],['Partner Zoo'],[['CONSTRICTION',1]]],
  ['483','红尾蚺',2,16,7,0,0,0,0,['reptile','americas'],['science','science'],[['CONSTRICTION',1]]],
  ['485','极北蝰',1,10,2,0,0,0,0,['reptile','europe'],['Partner Zoo'],[['HYPNOSIS',3]]],
  ['492','细鳞太攀蛇',2,10,5,0,0,1,0,['reptile','australia'],['australia','science'],[['VENOM',2]]],
  ['409','马来熊',2,16,5,0,0,0,0,['predator','bear','asia'],['Partner Zoo'],[['ACTION_ASSOCIATION',1]]],
  ['426','非洲草原象',5,36,10,0,1,0,0,['herbivore','africa','africa'],['animalsII'],[['RESISTANCE',1]]],
  ['427','白犀牛',4,24,9,0,0,1,0,['herbivore','africa'],['science'],[['ASSERTION',1]]],
  ['429','细纹斑马',2,12,6,0,1,0,0,['herbivore','africa'],['africa','africa','africa'],[['BOOST_SPONSORS',1],['FLOCK_ANIMAL',2]]],
  ['430','倭河马',2,15,6,0,0,0,1,['herbivore','africa'],['Partner Zoo'],[['ACTION_SPONSORS',1]]],
  ['431','亚洲象',5,33,8,1,0,0,1,['herbivore','asia','asia'],['animalsII'],[['RESISTANCE',1]]],
  ['432','印度犀',4,25,9,0,0,0,0,['herbivore','asia'],['animalsII'],[['ASSERTION',1]]],
  ['438','驯鹿',3,12,5,0,0,0,0,['herbivore','americas'],[],[['FLOCK_ANIMAL',3]]],
  ['439','大羊驼',2,10,4,0,0,0,0,['herbivore','americas'],[],[['FLOCK_ANIMAL',2]]],
  ['442','驼鹿',4,19,7,0,0,0,0,['herbivore','europe'],['herbivore','herbivore'],[['MULTIPLIER_SPONSORS',1],['FLOCK_ANIMAL',4]]],
  ['443','马鹿',3,12,5,0,0,0,0,['herbivore','europe'],[],[['FLOCK_ANIMAL',3]]],
  ['447','红袋鼠',4,23,7,0,0,0,0,['herbivore','australia'],[],[['POUCH',2],['FLOCK_ANIMAL',4]]],
  ['451','长鼻猴',5,32,10,2,0,1,0,['primate','asia'],['primate','primate','animalsII'],[['DOMINANCE',1]]],
  ['453','白颈白眉猴',4,20,8,0,0,0,0,['primate','africa'],['africa'],[['ACTION_CARDS',1]]],
  ['505','白头海雕',4,23,8,0,0,0,1,['bird','americas'],['animalsII'],[['DETERMINATION',1]]],
  ['509','金雕',5,20,7,0,0,1,0,['bird','europe'],['animalsII'],[['DETERMINATION',1]]],
  ['514','鸸鹋',5,22,7,0,0,0,0,['bird','australia'],['australia','australia'],[['PEACOCKING',1]]],
  ['515','澳大利亚鹈鹕',4,13,5,0,0,0,2,['bird','australia'],[],[['ACTION_BUILDING',1]]],
  ['408','懒熊',3,14,6,0,0,0,0,['predator','bear','asia'],[],[['BOOST_ASSOCIATION',1]]],
  ['415','北美浣熊',1,11,4,0,0,0,0,['predator','bear','americas'],[],[['BOOST_ASSOCIATION',1]]],
  ['416','普通棕熊',5,20,8,0,0,0,1,['predator','bear','europe'],['bear','animalsII'],[['MULTIPLIER_ASSOCIATION',1],['FULL_THROATED',1]]],
  ['419','欧洲獾',2,5,3,0,0,0,0,['predator','europe'],[],[['BOOST_ANIMAL',1]]],
  ['428','长颈鹿',3,16,7,0,0,0,0,['herbivore','africa'],[],[['BOOST_SPONSORS',1]]],
  ['434','小熊猫',2,16,6,0,0,0,0,['herbivore','bear','asia'],['science','science'],[['MULTIPLIER_SPONSORS',1]]],
  ['435','亚洲貘',2,17,5,0,1,0,0,['herbivore','asia'],[],[['DIGGING',3]]],
  ['440','山貘',2,15,4,1,0,1,0,['herbivore','americas'],[],[['DIGGING',2]]],
  ['445','非洲冕豪猪',1,8,3,0,0,0,0,['herbivore','europe'],[],[['DIGGING',2]]],
  ['446','儒艮',5,25,9,1,0,0,2,['herbivore','australia','australia'],['animalsII'],[['DIGGING',4]]],
  ['457','山魈',5,28,9,2,0,0,0,['primate','primate','africa'],['primate','primate','primate'],[['MULTIPLIER_CARD',1]]],
  ['466','玻利维亚红吼猴',3,12,6,0,0,0,0,['primate','americas'],[],[['BOOST_CARD',1]]],
  ['497','小红鹳',2,15,6,0,0,0,1,['bird','africa'],[],[['POSTURING',1]]],
  ['501','蓝孔雀',3,18,7,0,0,0,0,['bird','asia'],['asia'],[['POSTURING',2]]],
  ['502','双角犀鸟',2,13,6,0,0,0,0,['bird','asia'],[],[['BOOST_BUILDING',1]]],
  ['508','五彩金刚鹦鹉',1,16,4,0,0,0,0,['bird','americas'],['Partner Zoo'],[['POSTURING',3]]],
  ['510','白鹳',4,9,4,0,0,0,0,['bird','europe'],['europe'],[['MULTIPLIER_BUILDING',1]]],
  ['511','大红鹳',3,16,7,0,0,0,1,['bird','europe'],[],[['POSTURING',1]]],
  ['516','单垂鹤鸵',3,12,6,0,0,0,0,['bird','australia'],['Partner Zoo'],[['MULTIPLIER_BUILDING',1]]],
  ['518','小极乐鸟',1,15,5,0,0,0,0,['bird','australia'],[],[['POSTURING',1]]],
  ['524','曼加利察猪',1,7,0,0,0,0,0,['pet'],[],[['DIGGING',1],['PETTING_ZOO_ANIMAL',1]]],
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
const sponsorRows: [string, string, number, string[], string[], number, number?, number?][] = [
  ['207','基础研究',4,['science'],['sponsorsII','appeal'],0],
  ['215','全球繁育计划',4,[],['Partner Zoo','Partner Zoo'],0],
  ['216','优秀的协调员',5,[],['sponsorsII'],0], ['217','工程师',4,[],[],0],
  ['218','育种计划',4,[],['science','science'],0], ['219','综合研究员',5,['science'],['sponsorsII'],0],
  ['221','考古学家',4,['science'],['science'],0], ['222','发布专利',5,[],['appeal'],0],
  ['224','迁徙记录',4,['science'],['science'],0],
  ['227','世界动物园协会特别任务',6,[],['reputation'],0], ['228','世界动物园协会小型动物计划',5,[],['reputation'],0],
  ['243','狐獴窝',5,['herbivore'],['reputation'],0], ['244','企鹅馆',5,['bird'],['reputation'],0],
  ['245','水族馆',5,[],['reputation'],0], ['246','空中索道',6,[],[],0],
  ['247','狒狒栖息岩',6,['primate'],[],0], ['248','猕猴园',5,['primate'],[],0],
  ['249','猫头鹰棚屋',6,['bird'],[],0], ['250','海龟水族箱',5,['reptile'],[],0],
  ['251','北极熊展',5,['bear','predator'],[],0], ['252','斑鬣狗围场',5,['predator'],[],0],
  ['253','霍加狓棚厩',6,['herbivore'],[],0], ['254','动物园课外学校',5,[],[],1,1],
  ['255','儿童游乐园',3,[],[],0,0,4], ['256','水上乐园',3,[],[],0,0,4], ['257','园区边门',3,[],[],0],
  ['258','本地海鸟',5,['bird'],['appeal'],0], ['259','本地蜥蜴',5,['reptile'],['appeal'],0],
  ['260','本地农牧动物',5,['herbivore'],['appeal'],0], ['262','探险家',5,[],['sponsorsII'],0],
  ['263','世界动物园协会大型动物计划',5,[],['sponsorsII','reputation'],0], ['264','自由放养的新世界猴',5,['primate'],['appeal'],0],
  ['201','科学实验室',5,['science'],['sponsorsII'],0], ['202','发言人',5,['science'],['science'],0],
  ['204','科学博物馆',4,['science'],['science','science','science','science'],0],
  ['205','大猩猩野外研究',3,['science'],['science','science','science'],2,1],
  ['206','医学突破',5,['science'],['science','science','science','science'],0], ['208','科学图书馆',4,['science'],[],0],
  ['210','美洲专家',4,['americas'],[],0], ['211','欧洲专家',5,['europe'],[],0],
  ['212','澳洲专家',5,['australia'],[],0], ['213','亚洲专家',5,['asia'],[],0], ['214','非洲专家',4,['africa'],[],0],
  ['223','科研机构',3,['science','science'],[],0], ['241','水文学家',5,['water'],[],0], ['242','地质学家',5,['rock'],[],0],
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
export const ABILITY_LABELS: Record<string, string> = {
  SPRINT: '冲刺：从牌库抽牌', PACK: '群体：每个食肉图标获得 1 魅力', HUNTER: '狩猎：展示牌库并选择一张动物',
  CLEVER: '机灵：行动完成后移动一张行动卡至槽位 1', JUMPING: '跳跃：推进休息并获得等量资金',
  INVENTIVE: '创新：获得 X 标记', INVENTIVE_BEAR: '所有动物园每个熊图标获得 X，最多 3 枚',
  INVENTIVE_PRIMARY: '按灵长类图标获得 1/2/3 枚 X', ICONIC_ANIMAL: '标志动物：按所有动物园的大洲图标获得魅力，最多 8',
  SUN_BATHING: '日光浴：可卖出手牌，每张获得 4 资金', POUCH: '育儿袋：可将手牌置于本卡下，每张获得 2 魅力',
  SPONSOR_MAGNET: '赞助商磁石：获得展示区全部赞助商', SNAPPING_1: '精选 1 张展示牌', SNAPPING_2: '精选 2 张展示牌，可在两次间补牌',
  PERCEPTION_4: '洞察：抽 4 张保留 2 张', SCAVENGING: '食腐：洗混弃牌，抽取后保留 1 张', PETTING_ZOO_ANIMAL: '按萌宠图标获得 3 倍魅力',
  FULL_THROATED: '呼唤：解锁一个事务员',
  BOOST_ASSOCIATION: '调度协会：行动完成后可移到槽位 1 或 5', BOOST_ANIMAL: '调度动物：行动完成后可移到槽位 1 或 5',
  BOOST_SPONSORS: '调度赞助商：行动完成后可移到槽位 1 或 5', BOOST_CARD: '调度卡牌：行动完成后可移到槽位 1 或 5',
  BOOST_BUILDING: '调度建造：行动完成后可移到槽位 1 或 5',
  MULTIPLIER_ASSOCIATION: '在协会行动上放双重标记', MULTIPLIER_SPONSORS: '在赞助商行动上放双重标记',
  MULTIPLIER_CARD: '在卡牌行动上放双重标记', MULTIPLIER_BUILDING: '在建造行动上放双重标记',
  DIGGING: '挖掘：逐次弃换手牌或弃掉展示牌并立即补牌', POSTURING: '展示：逐座免费放置贩售亭或休憩亭',
  FLOCK_ANIMAL: '群居：可与已有同等或更大面积的食草动物共用安置空间',
  RESISTANCE: '坚韧：抽两张终局卡，保留一张；10 保护时仅弃一张，其余可共同计分',
  ASSERTION: '主张：可从尚未入场的基础保护项目中拿取一张',
  DOMINANCE: '支配：若灵长类基础项目尚未入场，将其加入手牌',
  ACTION_ASSOCIATION: '行动后可额外执行协会行动', ACTION_SPONSORS: '行动后可额外执行赞助商行动',
  ACTION_CARDS: '行动后可额外执行卡牌行动', ACTION_BUILDING: '行动后可额外执行建造行动',
  DETERMINATION: '决心：行动后额外执行一次任意行动', PEACOCKING: '开屏：可免费放置鸟禽馆，不要求建造 II',
  VENOM: '毒液：使魅力领先且至少 5 魅力的对手最低槽行动中毒',
  CONSTRICTION: '缠绕：按对手领先的轨道数影响其最高槽行动，强度 -2',
  HYPNOSIS: '催眠：行动完成后可执行魅力最高对手槽位 1–3 的行动',
  PILFERING_1: '偷窃：魅力最高对手选择支付 5 资金或被随机抽一张手牌',
  PILFERING_2: '偷窃两次：分别针对魅力最高与保护最高的对手'
};
export function sponsorDescription(id: string): string {
  if (id === '207') return '立即每两种不同动物类目／大洲图标获得 1 保护；对手每点获得 2 资金。魅力不得超过 25，需赞助商 II。';
  if (id === '215' || id === '218') return '放置两个通配标记。支持协会板下方基础项目时可用一个作为任意图标，每次最多一个；终局支持至少五次项目获得 1 保护。';
  if (id === '216') return '立即解锁一位事务员；终局声望至少 9 获得 1 保护。';
  if (id === '217') return '每次建造行动可按正常费用额外建造一座本次已建的普通建筑，不消耗强度；特殊饲养区不适用。终局覆盖整张地图获得 5 魅力。';
  if (id === '219') return '立即每个水域／岩石图标获得 2 资金；之后可覆盖水域岩石并忽略相邻地形要求；被覆盖地形不再参与连接统计。终局最多三组水＋岩各得 2 魅力。';
  if (id === '221') return '获得边界覆盖奖励时，可另选一个尚未覆盖奖励格的奖励，原格不视作覆盖；多个奖励可决定顺序。终局覆盖全部边界空地获得 1 保护。';
  if (id === '222') return '立即每个研究图标获得 1 保护，最多 3；对手每点获得 2 资金。魅力不得超过 25。';
  if (id === '224') return '立即获得 1 X；每次支持放归项目额外获得 1 保护，可重复支持同一放归项目的其他空等级。';
  if (id === '227') return '永久选择小型或大型方向；翻牌直到获得该类动物。以后打出该类动物获得 2／4 魅力，不得打出相反大小；3 格动物不受影响。';
  if (id === '228') return '立即每只小型动物获得 2 资金；一次动物行动只打小型时，可按正常费用额外打出一张手牌小型动物，然后可拿一张展示区小型动物。';
  if (id === '243') return '必须免费放置三格狐獴窝，邻接岩石；每次向自己的动物园打入食草图标获得 2 魅力。终局有六个图标获得 1 保护。';
  if (id === '244') return '必须免费放置四格企鹅馆，邻接水域；每次打入鸟图标获得 2 魅力。终局有六个鸟图标获得 1 保护。';
  if (id === '245') return '必须免费放置四格水族馆，邻接两水域；每次打入水域图标获得 2 魅力。终局有六个水域图标获得 1 保护。';
  if (id === '246') return '必须免费放置四格空中索道，邻接两岩石；每次打入岩石图标获得 2 魅力。终局有六个岩石图标获得 1 保护。';
  if (id === '247') return '必须免费放置四格狒狒栖息岩，邻接岩石；每次打入灵长类图标获得 2 魅力。终局有六个图标获得 1 保护。';
  if (id === '248') return '必须免费放置四格猕猴园；每次打入灵长类图标获得 1 X。';
  if (id === '249') return '必须免费放置三格猫头鹰棚屋；每次打入鸟图标抽两张保留一张。';
  if (id === '250') return '必须免费放置四格海龟水族箱，邻接水域；每次打入爬行图标，可卖出最多两张手牌，每张 4 资金。';
  if (id === '251') return '必须免费放置四格北极熊展，邻接水域；任意动物园每次打入熊图标获得 2 魅力；终局有 3–5／6 个熊图标获得 1／2 保护。';
  if (id === '252') return '必须免费放置四格斑鬣狗围场，邻接岩石；每次打入食肉图标，按自己的食肉图标数狩猎一次。';
  if (id === '253') return '必须免费放置四格霍加狓棚厩，放置三个标记；每次打入食草图标可消耗一个标记，按等级付费打出手牌赞助商。';
  if (id === '254') return '必须免费放置三格课外学校，覆盖至少两个边界格；立即获得 1 声望、1 保护并从牌库或声望范围拿一张牌。';
  if (id === '255' || id === '256') return `必须免费放置两格${id === '255' ? '儿童游乐园，邻接岩石' : '水上乐园，邻接水域'}；立即获得 4 魅力。`;
  if (id === '257') return '必须免费放置两格园区边门，覆盖两个边界格，可不邻接既有建筑；休息每个相邻有效建筑收入 2 资金，终局覆盖地图获得 5 魅力。';
  if (id === '258' || id === '259') return `立即每个已连接${id === '258' ? '水域' : '岩石'}获得 1 魅力；终局每两个孤立同类地形获得 1 保护。魅力不得超过 25。`;
  if (id === '260') return '立即每个已连接且未覆盖的边界空地获得 1 魅力；终局每组相连空地，每六格获得 1 保护。魅力不得超过 25。';
  if (id === '262') return '立即每种已有动物类目／大洲图标获得 2 资金；以后每打入一种新图标获得 1 魅力和 2 资金，重复图标不重复触发。';
  if (id === '263') return '立即可免费建造五格区；以后打大型动物可忽略一项前置条件，水域岩石不可豁免。';
  if (id === '264') return '立即每个已连接奖励格获得 1 魅力；终局每两个孤立奖励格获得 1 保护。魅力不得超过 25。';
  if (id === '201') return '需要赞助商 II。立即及每次休息从牌库或声望范围拿一张牌；终局有 3–5 / 6 个研究图标获得 1 / 2 保护。';
  if (id === '202') return '每次向自己的动物园打入研究图标，每个获得 1 声望，包括本卡及大学。';
  if (id === '204') return '立即每个已有研究图标获得 2 资金；每次打入自己的研究图标，每个获得 1 保护，包括本卡。';
  if (id === '205') return '立即获得 2 声望与 1 保护。';
  if (id === '206') return '立即每次已支持的保护项目获得 2 魅力；每次休息获得 1 保护。';
  if (id === '208') return '立即每个研究图标获得 1 魅力；任何动物园每次打入研究图标，每个获得 2 资金；终局有 5 种动物图标获得 1 保护。';
  if (id === '210') return '立即每个美洲图标获得 1 魅力；每次打入美洲图标可免费建一座贩售亭；终局至少 5 座贩售亭获得 1 保护。';
  if (id === '211') return '立即每个欧洲图标获得 1 魅力；每次打入欧洲图标可免费建 1 格区；终局至少 5 座占用的 1 格区获得 1 保护。';
  if (id === '212') return '立即每个澳洲图标获得 1 魅力；每次打入澳洲图标可在本卡下放一张手牌，获得 2 魅力。';
  if (id === '213') return '立即每个亚洲图标获得 1 魅力；每次打入亚洲图标可免费建一座休憩亭。';
  if (id === '214') return '立即每个非洲图标获得 1 魅力；每次打入非洲图标，在当前行动完成后可移动一张行动卡至槽位 1；终局每枚 X 获得 1 魅力。';
  if (id === '223') return '提供两个研究图标。';
  if (id === '241') return '立即每个水域图标获得 1 魅力；每覆盖一个邻接水域的格子获得 1 资金，每格只算一次；终局连接全部水域获得 1 保护。';
  if (id === '242') return '立即每两个岩石图标获得 3 魅力；每覆盖一个邻接岩石的格子获得 1 资金，每格只算一次；终局连接全部岩石获得 1 保护。';
  if (id === '203') return '打出时有 1/2/3 所大学获得 2/5/10 资金；项目所需协会强度降至 4；终局有三所大学获得 1 保护。';
  if (id === '209') return '立即和每次休息获得 1 枚 X；终局有三所大学获得 1 保护。';
  if (id === '220') return '立即和每次休息获得 3 资金；终局声望至少 9，获得 1 保护。';
  if (id === '225') return '立即获得 1 枚 X。免疫毒液、缠绕、催眠、偷窃；终局集齐 5 大洲获得 1 保护。';
  if (id === '226') return '立即获得 2 声望；终局集齐 5 大洲获得 1 保护。';
  if (id === '229') return '立即每只小型动物获得 1 魅力；之后安置小型动物费用减少 3。';
  if (id === '230') return '立即每只大型动物获得 2 魅力；之后安置大型动物费用减少 4。';
  if (Number(id) >= 231 && Number(id) <= 235) return '打出时每个对应动物图标获得 1 魅力；休息时有 1/3/5 个图标获得 3/6/9 资金。';
  if (Number(id) >= 236 && Number(id) <= 240) return '每次任何动物园打出对应动物图标时，每个图标获得 3 资金。包括本卡自身图标。';
  return '立即获得 1 魅力与 1 保护；终局集齐 5 种不同动物类目，获得 1 保护。';
}
export interface Project { id: string; name: string; tag: string; thresholds: number[]; points: number[] }
export interface DeckProject extends Project {
  mode: 'release' | 'breed' | 'collect';
  reputation: number[];
  playReputation: number;
}
export const DECK_PROJECTS: DeckProject[] = [
  ...[
    ['113', '巴伐利亚森林国家公园', 'europe'], ['114', '优胜美地国家公园', 'americas'],
    ['115', '安通国家公园', 'asia'], ['116', '塞伦盖蒂国家公园', 'africa'], ['117', '蓝山国家公园', 'australia'],
    ['118', '热带大草原', 'predator'], ['119', '低矮山脉', 'bird'], ['120', '竹林', 'herbivore'],
    ['121', '海蚀洞', 'reptile'], ['122', '丛林', 'primate']
  ].map(([id, name, tag]): DeckProject => ({ id: id!, name: name!, tag: tag!, thresholds: [4, 3, 2], points: [5, 4, 3], mode: 'release', reputation: [0, 0, 0], playReputation: 1 })),
  ...['bird', 'predator', 'reptile', 'herbivore', 'primate'].map((tag, index): DeckProject => ({
    id: String(123 + index), name: `${TAG_NAMES[tag]}动物繁育计划`, tag, thresholds: [1, 1, 1], points: [2, 1, 2],
    mode: 'breed', reputation: [2, 2, 0], playReputation: 0
  })),
  ...[
    { id: '128', name: '水生态', tag: 'water', thresholds: [5, 4, 2] },
    { id: '129', name: '地质学', tag: 'rock', thresholds: [5, 4, 2] },
    { id: '130', name: '小型动物', tag: 'animal-size-2', thresholds: [8, 5, 2] },
    { id: '131', name: '大型动物', tag: 'animal-size-4', thresholds: [4, 3, 2] },
    { id: '132', name: '科研', tag: 'science', thresholds: [5, 4, 2] }
  ].map((project): DeckProject => ({ ...project, mode: 'collect', points: [4, 3, 2], reputation: [0, 0, 0], playReputation: 0 }))
];
const specialSpaces: Record<string, ['reptile-house' | 'aviary', number]> = {
  '470': ['reptile-house', 1], '474': ['reptile-house', 1], '475': ['reptile-house', 1],
  '482': ['reptile-house', 1], '483': ['reptile-house', 1], '485': ['reptile-house', 0], '492': ['reptile-house', 1],
  '469': ['reptile-house', 3], '471': ['reptile-house', 2], '472': ['reptile-house', 1],
  '473': ['reptile-house', 0], '476': ['reptile-house', 2], '477': ['reptile-house', 0],
  '478': ['reptile-house', 0], '479': ['reptile-house', 2], '480': ['reptile-house', 2],
  '481': ['reptile-house', 2], '484': ['reptile-house', 1], '486': ['reptile-house', 0],
  '487': ['reptile-house', 0], '488': ['reptile-house', 0], '489': ['reptile-house', 3],
  '490': ['reptile-house', 2], '491': ['reptile-house', 1], '493': ['reptile-house', 0],
  '494': ['aviary', 4], '495': ['aviary', 1], '496': ['aviary', 1], '498': ['aviary', 1], '510': ['aviary', 1],
  '499': ['aviary', 1], '500': ['aviary', 1], '504': ['aviary', 1], '506': ['aviary', 1], '505': ['aviary', 1], '509': ['aviary', 1]
};
export const ZOO_CARDS: ZooCard[] = [
  ...animalRows.map(([id, name, size, price, appeal, conservation, reputation, rock, water, tags, requirements, abilities]): ZooCard => {
    const special = specialSpaces[id];
    return { id, name, kind: 'animal', size, price, appeal, conservation, reputation, rock, water, tags, requirements,
      abilities: abilities.map(([key, value]) => ({ key, value })), strength: 0,
      ...(special ? { specialHousing: { kind: special[0], space: special[1] } } : {}) };
  }),
  ...sponsorRows.map(([id, name, strength, tags, requirements, reputation, conservation = 0, appeal = 0]): ZooCard => ({
    id, name, kind: 'sponsor', strength, tags, requirements, reputation,
    size: 0, price: 0, appeal, conservation,
    rock: ({ '242': 1, '243': 1, '246': 2, '247': 1, '252': 1, '255': 1 } as Record<string, number>)[id] ?? 0,
    water: ({ '241': 1, '244': 1, '245': 2, '250': 1, '251': 1, '256': 1 } as Record<string, number>)[id] ?? 0, abilities: []
  })),
  ...DECK_PROJECTS.map((project): ZooCard => ({
    id: project.id, name: project.name, kind: 'project', strength: 0, tags: [], requirements: [], reputation: 0,
    size: 0, price: 0, appeal: 0, conservation: 0, rock: 0, water: 0, abilities: []
  }))
];
export const CARD_IDS = ZOO_CARDS.map(card => card.id);
const byId = new Map(ZOO_CARDS.map(card => [card.id, card]));
export function zooCard(id: string): ZooCard {
  let card = byId.get(id);
  if (!card) {
    const base = BASE_PROJECTS.find(project => project.id === id);
    if (base) card = { id, name: base.name, kind: 'project', size: 0, price: 0, appeal: 0, conservation: 0, reputation: 0, rock: 0, water: 0, tags: [], requirements: [], abilities: [], strength: 0 };
  }
  if (!card) throw new Error(`卡牌 ${id} 不在已实现牌池中。`);
  return card;
}
export function projectDescription(id: string): string {
  const project = DECK_PROJECTS.find(project => project.id === id);
  if (!project) {
    const base = BASE_PROJECTS.find(project => project.id === id);
    return base ? `基础项目 ${base.name}：${base.thresholds.join(' / ')} 个${TAG_NAMES[base.tag]}，获得 ${base.points.join(' / ')} 保护。从手牌取得的项目须通过协会打出并立即支持。` : '';
  }
  const tag = TAG_NAMES[project.tag] ?? (project.tag === 'animal-size-2' ? '小型动物' : '大型动物');
  return project.mode === 'release' ? `放归一只${tag}动物（标准面积分别为 4–5 / 3 / 1–2），获得 5 / 4 / 3 保护。首次打入场时获得 1 声望。` :
    project.mode === 'breed' ? `需要一只${tag}动物与其同大洲的合作动物园；占用空置等级，获得对应保护与声望。` :
    `统计动物园内的${tag}：${project.thresholds.join(' / ')}，获得 4 / 3 / 2 保护。`;
}
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
  '当前支持双人地图 A / 0 / 1 / 2、128 张动物、64 张赞助商、20 张牌库保护项目、12 基础项目和 11 终局卡。',
  '群居、额外行动、坚韧、独有建筑、通配项目和双人互动已接入；程序验证与逐卡人工复核分别登记，完整基础版仍需人工整局验收。',
  '地图 3–8、三四人和单人模式尚未开放；当前规则版本与旧阶段四存档不兼容，原文件保留，不自动迁移。'
];
