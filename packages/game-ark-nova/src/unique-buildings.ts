import type { Hex } from '@eurogame/mechanisms';

interface UniqueBuildingSpec {
  card: string;
  name: string;
  cells: Hex[];
  water: number;
  rock: number;
  border: number;
  detached?: boolean;
}
export const UNIQUE_BUILDINGS = {
  'unique-243': { card: '243', name: '狐獴窝', cells: [{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 2, r: -1 }], water: 0, rock: 1, border: 0 },
  'unique-244': { card: '244', name: '企鹅馆', cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: -1 }, { q: 2, r: 0 }], water: 1, rock: 0, border: 0 },
  'unique-245': { card: '245', name: '水族馆', cells: [{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 2, r: -1 }, { q: 2, r: 0 }], water: 2, rock: 0, border: 0 },
  'unique-246': { card: '246', name: '空中索道', cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }, { q: 0, r: 3 }], water: 0, rock: 2, border: 0 },
  'unique-247': { card: '247', name: '狒狒栖息岩', cells: [{ q: 0, r: 1 }, { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 1, r: 1 }], water: 0, rock: 1, border: 0 },
  'unique-248': { card: '248', name: '猕猴园', cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 1, r: 2 }], water: 0, rock: 0, border: 0 },
  'unique-249': { card: '249', name: '猫头鹰棚屋', cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }], water: 0, rock: 0, border: 0 },
  'unique-250': { card: '250', name: '海龟水族箱', cells: [{ q: 0, r: 1 }, { q: 1, r: -1 }, { q: 1, r: 0 }, { q: 2, r: 0 }], water: 1, rock: 0, border: 0 },
  'unique-251': { card: '251', name: '北极熊展', cells: [{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 2, r: -1 }, { q: 3, r: -2 }], water: 1, rock: 0, border: 0 },
  'unique-252': { card: '252', name: '斑鬣狗围场', cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }, { q: 1, r: -1 }], water: 0, rock: 1, border: 0 },
  'unique-253': { card: '253', name: '霍加狓棚厩', cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: -1 }, { q: 3, r: -1 }], water: 0, rock: 0, border: 0 },
  'unique-254': { card: '254', name: '动物园课外学校', cells: [{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 2, r: -1 }], water: 0, rock: 0, border: 2 },
  'unique-255': { card: '255', name: '儿童游乐园', cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }], water: 0, rock: 1, border: 0 },
  'unique-256': { card: '256', name: '水上乐园', cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }], water: 1, rock: 0, border: 0 },
  'unique-257': { card: '257', name: '园区边门', cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }], water: 0, rock: 0, border: 2, detached: true }
} satisfies Record<string, UniqueBuildingSpec>;
export type UniqueBuildingKind = keyof typeof UNIQUE_BUILDINGS;
export function uniqueSpec(kind: string): UniqueBuildingSpec | undefined { return UNIQUE_BUILDINGS[kind as UniqueBuildingKind]; }
export function uniqueKind(card: string): UniqueBuildingKind | null {
  const kind = `unique-${card}` as UniqueBuildingKind;
  return kind in UNIQUE_BUILDINGS ? kind : null;
}
