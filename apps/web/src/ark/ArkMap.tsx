import { useEffect, useId } from 'react';
import { hexKey } from '@eurogame/mechanisms';
import { mapCells, MAP_INFO, nextToLandmark, housingCapacity, buildingUsedSpace, BUILDING_NAMES, zooCard, adjacentTerrainCells, housingError, type ArkPlayer } from '@eurogame/game-ark-nova';
import { ArkIcon } from './ArkIcon.js';
import { useArkGuide } from './ArkGuide.js';
import { ATLASES, SPRITES } from '../../asset-definitions.js';
import { preloadAsset, useArkAssets } from './asset-store.js';

const rewardSymbols: Record<string, string> = { 'money-5': '5', 'money-10': '10', 'draw-2': '▤ 2', x: 'X', worker: '♟+', snap: '▤', 'reputation-1': '◆1', 'reputation-2': '◆2', upgrade: 'II↑', clever: '↤1', partner: '🌐', 'paid-sponsor': '◈ → ◇' };
export function mapCenter(q: number, r: number) { return { x: 53 + q * 53, y: 117 + (r + q / 2) * 61.2 }; }
function hexPoints(q: number, r: number, radius = 33.5) {
  const center = mapCenter(q, r);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`;
  }).join(' ');
}
function buildingBorder(cells: { q: number; r: number }[]): string {
  const own = new Set(cells.map(hexKey));
  const neighbors = [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }];
  return cells.flatMap(cell => neighbors.flatMap((neighbor, edge) => {
    if (own.has(hexKey({ q: cell.q + neighbor.q, r: cell.r + neighbor.r }))) return [];
    const center = mapCenter(cell.q, cell.r);
    const first = edge * Math.PI / 3;
    const second = (edge + 1) * Math.PI / 3;
    return [`M${center.x + 33.5 * Math.cos(first)} ${center.y + 33.5 * Math.sin(first)}L${center.x + 33.5 * Math.cos(second)} ${center.y + 33.5 * Math.sin(second)}`];
  })).join(' ');
}
export function ArkMap({ player, draft, valid, onCell, selectedBuilding, onBuilding, showCoordinates = false, assets = {}, animal: selectedAnimal, interaction }: {
  player: ArkPlayer; draft: { q: number; r: number }[]; valid: boolean;
  onCell: (q: number, r: number) => void; selectedBuilding: string | null;
  onBuilding: (id: string) => void; showCoordinates?: boolean; assets?: Record<string, string>; animal?: string;
  interaction?: { locked: boolean; rotation: number; flip: boolean; anchors: string[]; onHover: (q: number, r: number) => void; onRotate: () => void; onFlip: () => void; onUnlock: () => void };
}) {
  const unique = useId().replaceAll(':', '');
  const guide = useArkGuide();
  const focus = guide?.focus;
  const animal = focus?.cardId && (focus.kind === 'terrain' || focus.kind === 'housing') ? focus.cardId : selectedAnimal;
  const assetState = useArkAssets();
  const occupied = new Map(player.buildings.flatMap(building => building.cells.map(cell => [hexKey(cell), building] as const)));
  const previews = new Set(draft.map(hexKey));
  const selected = player.buildings.find(building => building.id === selectedBuilding);
  const terrainKinds: ('water' | 'rock')[] = focus?.kind === 'terrain' && (focus.key === 'water' || focus.key === 'rock') ? [focus.key] : ['water', 'rock'];
  const terrain = new Set(selected && animal ? terrainKinds.flatMap(terrain => adjacentTerrainCells(selected.cells, terrain, player.map)).map(hexKey) : []);
  const eligible = new Set(animal ? player.buildings.filter(building => !housingError(building, animal, player.map, player.sponsors.includes('219'))).map(building => building.id) : []);
  const landmark = MAP_INFO[player.map].landmark;
  const anchors = new Set(interaction?.anchors);
  const usable = (alias: string) => Boolean(assets[alias] && assetState.status[assets[alias]!] === 'ready');
  const landmarkAlias = `map${player.map}`;
  const landmarkArt = usable(landmarkAlias);
  useEffect(() => { if (assets[landmarkAlias]) void preloadAsset(assets[landmarkAlias]!); }, [assets[landmarkAlias]]);
  function pattern(name: string, spriteId: string) {
    const sprite = SPRITES[spriteId];
    if (!sprite || !usable(sprite.atlas)) return null;
    const atlas = ATLASES.find(atlas => atlas.alias === sprite.atlas)!;
    return <pattern key={name} id={`${unique}-${name}`} width="1" height="1" patternContentUnits="objectBoundingBox"><svg width="1" height="1" viewBox={sprite.rect.join(' ')} preserveAspectRatio="none"><image href={assets[sprite.atlas]} width={atlas.width} height={atlas.height} /></svg></pattern>;
  }
  return <div className={`ark-map-panel ${interaction ? 'is-placing' : ''}`} data-guided-terrain={focus?.kind === 'terrain' ? focus.key : undefined} data-placement-locked={interaction?.locked ?? false} data-preview-rotation={interaction?.rotation} data-preview-flip={interaction?.flip}><div className="ark-map-heading"><span>动物园地图 {player.map} · {MAP_INFO[player.map].name}</span><span title={MAP_INFO[player.map].description}>覆盖全部可建造格：+7 魅力</span></div>
    <svg className="ark-map" viewBox="5 40 520 465" role="group" aria-label={`${player.name} 地图 ${player.map}`}>
      <defs><pattern id={`${unique}-grass`} width="13" height="13" patternUnits="userSpaceOnUse"><path d="m3 9 2-3 1 3m5-6-1 3" stroke="#96ae62" strokeWidth=".7" opacity=".6" /></pattern>
        {pattern('landmark', `landmark.${player.map}`)}{pattern('rock', 'terrain.rock')}{pattern('land', 'terrain.land')}
        {pattern('water', 'terrain.water')}{pattern('kiosk', 'building.kiosk')}{pattern('pavilion', 'building.pavilion')}
      </defs>
      <rect x="5" y="40" width="520" height="465" rx="20" fill="#acc486" />
      {mapCells(player.map).map(cell => {
        const key = hexKey(cell);
        const building = occupied.get(key);
        const center = mapCenter(cell.q, cell.r);
        const chosen = building?.id === selectedBuilding;
        const feature = landmark && hexKey(landmark.cell) === key;
        const classes = ['ark-hex', cell.terrain, feature ? 'landmark' : '', building ? 'built' : '', building && buildingUsedSpace(building) > 0 ? 'inhabited' : '', building?.kind === 'kiosk' ? 'kiosk' : '', building?.kind === 'pavilion' ? 'pavilion' : '', previews.has(key) ? valid ? 'draft-valid' : 'draft-invalid' : '', chosen ? 'chosen-building' : '', terrain.has(key) ? 'adjacent-terrain' : '', building && eligible.has(building.id) ? 'eligible-housing' : ''].join(' ');
        const choose = () => { if (building && !interaction) onBuilding(building.id); else onCell(cell.q, cell.r); };
        return <g key={key} className={classes}><polygon points={hexPoints(cell.q, cell.r)} data-cell={`${cell.q},${cell.r}`} tabIndex={0} role="button" aria-label={`地图 ${player.map} 格 ${cell.q},${cell.r}${building ? ` ${BUILDING_NAMES[building.kind]}` : ` ${cell.terrain === 'land' ? '空地' : cell.terrain === 'water' ? '水域' : '岩石'}`}`} onPointerEnter={() => interaction?.onHover(cell.q, cell.r)} onPointerMove={() => interaction?.onHover(cell.q, cell.r)} onClick={choose} onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
        }}><title>{building ? `${BUILDING_NAMES[building.kind]}${building.animals.length ? `：${building.animals.map(id => zooCard(id).name).join('、')}` : ' · 闲置'}` : cell.terrain === 'land' ? `${cell.q},${cell.r}${cell.reward ? ` 放置奖励 ${rewardSymbols[cell.reward]}` : ''}${cell.upgraded ? ' 需要建造 II' : ''}` : cell.terrain}</title></polygon>
          {cell.terrain === 'land' && !building && <polygon points={hexPoints(cell.q, cell.r, 31)} fill={`url(#${unique}-${usable('mapA') && !previews.has(key) ? 'land' : 'grass'})`} className="ark-decor" />}
          {cell.terrain === 'water' && (usable('tiles') ? <polygon points={hexPoints(cell.q, cell.r, 31)} fill={`url(#${unique}-water)`} className="ark-decor" /> : <path d={`m${center.x - 18} ${center.y}q9-8 18 0t18 0m-30 9q7-6 14 0t14 0`} className="water-waves ark-decor" />)}
          {cell.terrain === 'rock' && (usable('mapA') ? <polygon className="ark-decor" points={hexPoints(cell.q, cell.r, 31)} fill={`url(#${unique}-rock)`} /> : <g className="ark-decor"><path d={`m${center.x - 22} ${center.y + 14} 6-25 18-9 20 20-9 18Z`} fill="#736d72" /><path d={`m${center.x - 16} ${center.y - 11} 18-9-4 24-20 10m20-10 22-4`} stroke="#c8bdaf" fill="none" strokeWidth="3" /></g>)}
          {feature && <g className="ark-decor">{landmarkArt ? <polygon points={hexPoints(cell.q, cell.r, 30)} fill={`url(#${unique}-landmark)`} /> : <g transform={`translate(${center.x} ${center.y})`}><path d={player.map === '1' ? 'M-10 18V-18H10V18M-10-12 10-2-10 8 10 18M-14-20H14' : 'M-20 18V-12H-8V18M8 18V-12H20V18M-8 0Q0-22 8 0'} fill="none" stroke="#fef8e3" strokeWidth="4" /></g>}<text x={center.x} y={center.y + 23} textAnchor="middle" className="building-name amenity-label">{landmark!.name}</text></g>}
          {(building?.kind === 'kiosk' || building?.kind === 'pavilion') && (usable('tiles')
            ? <polygon className="ark-decor" points={hexPoints(cell.q, cell.r, 30)} fill={`url(#${unique}-${building.kind})`} />
            : <g className="ark-decor" transform={`translate(${center.x - 19} ${center.y - 23})`}><path d="m0 14 7-12h24l7 12M5 16v25h28V16" fill={building.kind === 'kiosk' ? '#b96e43' : '#839b69'} stroke="#3f3429" strokeWidth="2" /><path d="M0 14h38M12 3v11m14-11v11M12 24h14v17" stroke="#fff1c8" strokeWidth="3" fill="none" /></g>)}
          {!building &&
            cell.reward && <g className="ark-decor"><circle cx={center.x} cy={center.y} r={14} fill="#f4d966" stroke="#fdf4c1" strokeWidth="2" /><text x={center.x} y={center.y + 4} textAnchor="middle" className="reward-label">{rewardSymbols[cell.reward]}</text></g>}
          {cell.upgraded && !building && <text x={center.x + 12} y={center.y + 24} className="upgraded-label ark-decor">II</text>}
          {showCoordinates && <text x={center.x} y={center.y + 24} textAnchor="middle" className="coordinate-label ark-decor">{cell.q},{cell.r}</text>}
          {interaction && anchors.has(key) && !building && <circle className="ark-anchor-dot ark-decor" cx={center.x} cy={center.y + 21} r="3.5" />}
        </g>;
      })}
      {player.buildings.map(building => {
        const centers = building.cells.map(cell => mapCenter(cell.q, cell.r));
        const center = { x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length, y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length };
        const special = ['petting', 'reptile-house', 'aviary'].includes(building.kind);
        const amenity = building.kind === 'kiosk' || building.kind === 'pavilion';
        const caption = building.kind.startsWith('unique-') ? BUILDING_NAMES[building.kind] : special ? `${BUILDING_NAMES[building.kind]} ${buildingUsedSpace(building)}/${building.kind === 'petting' ? 3 : 5}` : amenity ? BUILDING_NAMES[building.kind] : building.animals.length ? zooCard(building.animals[0]!).name.slice(0, 5) : buildingUsedSpace(building) ? '已占用' : `⬡ ${building.cells.length}${player.map === '2' && nextToLandmark(building, player.map) ? `→${housingCapacity(building, player.map)}` : ''}`;
        return <g className="ark-decor" key={building.id}><path d={buildingBorder(building.cells)} fill="none" stroke={building.id === selectedBuilding ? '#187d82' : building.animals.length ? '#66823d' : '#9a7f48'} strokeWidth={building.id === selectedBuilding ? 3.4 : 2.6} strokeLinejoin="round" /><text x={center.x} y={center.y + (amenity ? 24 : 4)} textAnchor="middle" className={`building-name ${amenity ? 'amenity-label' : ''}`}>{caption}</text></g>;
      })}
      {interaction && draft.length > 0 && <path className={`ark-placement-outline ark-decor ${valid ? 'valid' : 'invalid'}`} d={buildingBorder(draft)} fill="none" />}
    </svg>
    {interaction && <div className="ark-map-tools" role="toolbar" aria-label="建筑预览工具"><span>{interaction.locked ? '位置已锁定' : '移动预览 · 点击锁定'}</span><button title="旋转（R）" aria-label="地图旋转建筑" onClick={interaction.onRotate}>↻ <kbd>R</kbd></button><button title="镜像（F）" aria-label="地图镜像建筑" aria-pressed={interaction.flip} onClick={interaction.onFlip}>⇆ <kbd>F</kbd></button><button aria-label="解锁建筑预览" disabled={!interaction.locked} onClick={interaction.onUnlock}>解锁 <kbd>Esc</kbd></button></div>}
    <div className="ark-map-legend"><span><ArkIcon name="enclosure" />闲置</span><span><ArkIcon name="water" />水域</span><span><ArkIcon name="rock" />岩石</span><span><ArkIcon name="kiosk" />贩售亭</span></div>
    {animal && <p className="ark-map-hint">青色圈：所选区共边邻接的地形 · 绿色虚线：可安置区</p>}
    {landmark && <p className="ark-map-hint" data-testid="ark-map-ability">{MAP_INFO[player.map].description}</p>}
  </div>;
}
