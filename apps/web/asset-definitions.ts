export const ASSET_SOURCE = {
  repository: 'https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards',
  usage: 'local-reference-only' as const,
  license: 'unverified',
  notice: '本地参考素材；公开构建使用项目自有矢量图。'
};

export interface AtlasDefinition {
  id: string;
  alias: string;
  file: string;
  width: number;
  height: number;
  label: string;
}
export const ATLASES: AtlasDefinition[] = [
  { id: 'atlas.projects', alias: 'projectAtlas', file: 'projects.jpg', width: 2262, height: 1596, label: '保护项目插画' },
  { id: 'atlas.badges', alias: 'badges', file: 'zoo-card-badges.webp', width: 1480, height: 2072, label: '卡牌与行动图标' },
  { id: 'atlas.tiles', alias: 'tiles', file: 'enclosures.jpg', width: 2516, height: 2120, label: '建筑与水面' },
  { id: 'atlas.map-a', alias: 'mapA', file: 'maps/plana.jpg', width: 4038, height: 2130, label: '地形纹理' },
  { id: 'atlas.map-1', alias: 'map1', file: 'maps/plan1.jpg', width: 4038, height: 2130, label: '观测塔地标' },
  { id: 'atlas.map-2', alias: 'map2', file: 'maps/plan2.jpg', width: 4038, height: 2130, label: '户外营地地标' }
];
export interface SpriteDefinition {
  atlas: string;
  rect: readonly [number, number, number, number];
  label: string;
}
const badgePositions: Record<string, [number, number]> = {
  animals: [0, 0], animalsII: [1, 0], build: [2, 0], cards: [4, 0], sponsors: [1, 1], sponsorsII: [2, 1],
  worker: [3, 1], africa: [0, 2], americas: [1, 2], asia: [2, 2], australia: [3, 2], europe: [4, 2],
  appeal: [0, 3], 'Partner Zoo': [1, 3], reputation: [2, 3], science: [3, 3],
  primate: [0, 4], bear: [1, 4], bird: [3, 4], predator: [4, 4], herbivore: [0, 5], reptile: [1, 5], pet: [2, 5]
};
export const SPRITES: Record<string, SpriteDefinition> = {
  ...Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`project.${101 + index}`, {
    atlas: 'projectAtlas', rect: [index % 6 * 377, Math.floor(index / 6) * 266, 377, 266] as const,
    label: `保护项目 ${101 + index}`
  }])),
  ...Object.fromEntries(Object.entries(badgePositions).map(([name, [column, row]]) => [`badge.${name}`, {
    atlas: 'badges', rect: [column * 296, row * 296, 296, 296] as const, label: name
  }])),
  'terrain.land': { atlas: 'mapA', rect: [590, 700, 272, 236], label: '空地' },
  'terrain.rock': { atlas: 'mapA', rect: [815, 1505, 225, 239], label: '岩石' },
  'terrain.water': { atlas: 'tiles', rect: [1632, 0, 272, 236], label: '水域' },
  'building.kiosk': { atlas: 'tiles', rect: [408, 471, 272, 236], label: '贩售亭' },
  'building.pavilion': { atlas: 'tiles', rect: [1020, 589, 272, 236], label: '休憩亭' },
  'landmark.1': { atlas: 'map1', rect: [783, 828, 272, 236], label: '观测塔' },
  'landmark.2': { atlas: 'map2', rect: [1603, 1066, 272, 236], label: '户外营地' }
};

export function spriteStyle(id: string): { backgroundSize: string; backgroundPosition: string } | null {
  const sprite = SPRITES[id];
  if (!sprite) return null;
  const atlas = ATLASES.find(atlas => atlas.alias === sprite.atlas)!;
  const [left, top, width, height] = sprite.rect;
  return {
    backgroundSize: `${atlas.width / width * 100}% ${atlas.height / height * 100}%`,
    backgroundPosition: `${left / (atlas.width - width) * 100}% ${top / (atlas.height - height) * 100}%`
  };
}
export function validateSpriteDefinitions(): string[] {
  const issues: string[] = [];
  const aliases = new Set(ATLASES.map(atlas => atlas.alias));
  if (aliases.size !== ATLASES.length) issues.push('图集别名重复。');
  for (const [id, sprite] of Object.entries(SPRITES)) {
    const atlas = ATLASES.find(atlas => atlas.alias === sprite.atlas);
    const [left, top, width, height] = sprite.rect;
    if (!atlas || ![left, top, width, height].every(Number.isInteger) || left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > atlas.width || top + height > atlas.height) issues.push(`${id} 图集区域越界。`);
  }
  return issues;
}
