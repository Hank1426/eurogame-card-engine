import { hexKey } from '@eurogame/mechanisms';
import { mapCells, buildingUsedSpace, BUILDING_NAMES, zooCard, type ArkPlayer } from '@eurogame/game-ark-nova';

const rewardSymbols: Record<string, string> = { 'money-5': '5', 'money-10': '10', 'draw-2': '▤ 2', x: 'X', worker: '♟+', snap: '▤', 'reputation-2': '◆2', upgrade: 'II↑' };
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
export function ArkMap({ player, draft, valid, onCell, selectedBuilding, onBuilding, showCoordinates = false }: {
  player: ArkPlayer; draft: { q: number; r: number }[]; valid: boolean;
  onCell: (q: number, r: number) => void; selectedBuilding: string | null;
  onBuilding: (id: string) => void; showCoordinates?: boolean;
}) {
  const occupied = new Map(player.buildings.flatMap(building => building.cells.map(cell => [hexKey(cell), building] as const)));
  const previews = new Set(draft.map(hexKey));
  return <div className="ark-map-panel"><div className="ark-map-heading"><span>动物园地图 {player.map}</span><span>覆盖全部可建造格：+7 魅力</span></div>
    <svg className="ark-map" viewBox="0 0 530 535" role="group" aria-label={`${player.name} 地图 ${player.map}`}>
      <defs><pattern id="grass-hatch" width="13" height="13" patternUnits="userSpaceOnUse"><path d="m3 9 2-3 1 3m5-6-1 3" stroke="#96ae62" strokeWidth=".7" opacity=".6" /></pattern></defs>
      <rect x="5" y="30" width="520" height="475" rx="32" fill="#d9e4b8" />
      {mapCells(player.map).map(cell => {
        const key = hexKey(cell);
        const building = occupied.get(key);
        const center = mapCenter(cell.q, cell.r);
        const chosen = building?.id === selectedBuilding;
        const classes = ['ark-hex', cell.terrain, building ? 'built' : '', building && buildingUsedSpace(building) > 0 ? 'inhabited' : '', building?.kind === 'kiosk' ? 'kiosk' : '', building?.kind === 'pavilion' ? 'pavilion' : '', previews.has(key) ? valid ? 'draft-valid' : 'draft-invalid' : '', chosen ? 'chosen-building' : ''].join(' ');
        const choose = () => { if (building) onBuilding(building.id); else onCell(cell.q, cell.r); };
        return <g key={key} className={classes}><polygon points={hexPoints(cell.q, cell.r)} tabIndex={0} role="button" aria-label={`地图 ${player.map} 格 ${cell.q},${cell.r}${building ? ` ${BUILDING_NAMES[building.kind]}` : ` ${cell.terrain === 'land' ? '空地' : cell.terrain === 'water' ? '水域' : '岩石'}`}`} onClick={choose} onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
        }}><title>{building ? `${BUILDING_NAMES[building.kind]}${building.animals.length ? `：${building.animals.map(id => zooCard(id).name).join('、')}` : ' · 闲置'}` : cell.terrain === 'land' ? `${cell.q},${cell.r}${cell.reward ? ` 放置奖励 ${rewardSymbols[cell.reward]}` : ''}${cell.upgraded ? ' 需要建造 II' : ''}` : cell.terrain}</title></polygon>
          {cell.terrain === 'land' && !building && <polygon points={hexPoints(cell.q, cell.r, 31)} fill="url(#grass-hatch)" className="ark-decor" />}
          {cell.terrain === 'water' && <path d={`m${center.x - 18} ${center.y}q9-8 18 0t18 0m-30 9q7-6 14 0t14 0`} className="water-waves ark-decor" />}
          {cell.terrain === 'rock' && <g className="ark-decor"><path d={`m${center.x - 20} ${center.y + 13} 5-23 18-7 17 17-5 17Z`} fill="#9c9b8c" /><path d={`m${center.x - 15} ${center.y - 10} 18-7-4 22-19 8m19-8 21-5`} stroke="#c7c7b8" fill="none" strokeWidth="2" /></g>}
          {!building &&
            cell.reward && <g className="ark-decor"><circle cx={center.x} cy={center.y} r={14} fill="#f4d966" stroke="#fdf4c1" strokeWidth="2" /><text x={center.x} y={center.y + 4} textAnchor="middle" className="reward-label">{rewardSymbols[cell.reward]}</text></g>}
          {cell.upgraded && !building && <text x={center.x + 12} y={center.y + 24} className="upgraded-label ark-decor">II</text>}
          {showCoordinates && <text x={center.x} y={center.y + 24} textAnchor="middle" className="coordinate-label ark-decor">{cell.q},{cell.r}</text>}
        </g>;
      })}
      {player.buildings.map(building => {
        const centers = building.cells.map(cell => mapCenter(cell.q, cell.r));
        const center = { x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length, y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length };
        const special = ['petting', 'reptile-house', 'aviary'].includes(building.kind);
        const caption = special ? `${BUILDING_NAMES[building.kind]} ${buildingUsedSpace(building)}/${building.kind === 'petting' ? 3 : 5}` : building.kind === 'kiosk' ? '▥' : building.kind === 'pavilion' ? '♧' : building.animals.length ? zooCard(building.animals[0]!).name.slice(0, 5) : buildingUsedSpace(building) ? '已占用' : `⬡ ${building.cells.length}`;
        return <g className="ark-decor" key={building.id}><path d={buildingBorder(building.cells)} fill="none" stroke={building.id === selectedBuilding ? '#497577' : building.animals.length ? '#66823d' : '#9a7f48'} strokeWidth={building.id === selectedBuilding ? 3.4 : 2.6} strokeLinejoin="round" /><text x={center.x} y={center.y + 4} textAnchor="middle" className="building-name">{caption}</text></g>;
      })}
    </svg>
    <div className="ark-map-legend"><span>⬡ 闲置饲养区</span><span>🐾 已安置动物</span><span>≈ 水域</span><span>▲ 岩石</span><span>▥ 贩售亭</span></div>
  </div>;
}
