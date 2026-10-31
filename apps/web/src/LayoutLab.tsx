import { useState } from 'react';
import { hexKey, transformHexes, validatePlacement, type Hex } from '@eurogame/mechanisms';
import { SectionHeading } from '@eurogame/ui-kit';

const board: Hex[] = Array.from({ length: 7 }, (_, row) => Array.from({ length: 8 }, (_, column) => ({ q: column - Math.floor(row / 2), r: row }))).flat();
const shapes = {
  small: [{ q: 0, r: 0 }],
  medium: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
  large: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 0 }]
};

function center(hex: Hex) {
  return { x: 60 + 46 * Math.sqrt(3) * (hex.q + hex.r / 2), y: 57 + 69 * hex.r };
}
function points(hex: Hex): string {
  const position = center(hex);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (60 * index - 30) * Math.PI / 180;
    return `${position.x + 43 * Math.cos(angle)},${position.y + 43 * Math.sin(angle)}`;
  }).join(' ');
}

export function LayoutLab() {
  const [size, setSize] = useState<keyof typeof shapes>('medium');
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [anchor, setAnchor] = useState<Hex>({ q: 1, r: 0 });
  const [placements, setPlacements] = useState<Hex[][]>([[{ q: 0, r: 0 }]]);
  const [credits, setCredits] = useState(25);
  const shape = transformHexes(shapes[size], rotation, flip);
  const occupied = placements.flat();
  const cost = shape.length * 2;
  const reason = validatePlacement(board, occupied, shape, anchor) ?? (credits < cost ? '资金不足。' : null);
  const preview = new Set(shape.map(hex => hexKey({ q: hex.q + anchor.q, r: hex.r + anchor.r })));
  const occupiedKeys = new Set(occupied.map(hexKey));

  return <div className="layout-lab">
    <div className="notice"><strong>建造交互原型</strong><span>自制演示地图，用于验证邻接、旋转和操作反馈；尚未接入方舟正式地图与规则。</span></div>
    <SectionHeading eyebrow="SPATIAL INTERACTION" title="把操作留在地图旁边" extra={<span className="pill">可用资金 {credits} ◈</span>} />
    <div className="layout-columns">
      <div className="map-panel"><div className="map-label"><span>FIELD NOTES / 01</span><strong>林地规划实验</strong></div>
        <svg className="hex-board" viewBox="0 0 720 530" aria-label="建造实验地图">
          {board.map(hex => {
            const key = hexKey(hex);
            return <g key={key}><polygon points={points(hex)} className={`${occupiedKeys.has(key) ? 'hex occupied' : 'hex'} ${preview.has(key) ? reason ? 'preview invalid' : 'preview valid' : ''}`}
              role="button" tabIndex={0} aria-label={`地图格 ${key}`} onClick={() => setAnchor(hex)} onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setAnchor(hex); }
              }} /><text x={center(hex).x} y={center(hex).y + 4} textAnchor="middle">{occupiedKeys.has(key) ? '✦' : `${hex.q},${hex.r}`}</text></g>;
          })}
        </svg><div className="map-legend"><span>● 已建造</span><span>◌ 点击格子预览</span><span>绿色可放置 / 红色需调整</span></div>
      </div>
      <aside className="panel build-controls">
        <span className="eyebrow">BUILDING DRAFT</span><h2>规划一片新生境</h2><p className="muted">选择面积，再点击地图设定锚点。旋转与镜像会实时更新合法性。</p>
        <label htmlFor="building-size">建筑面积</label><select id="building-size" value={size} onChange={event => setSize(event.target.value as keyof typeof shapes)}>
          <option value="small">1 格 · 小型生境</option><option value="medium">3 格 · 标准生境</option><option value="large">5 格 · 大型生境</option>
        </select>
        <div className="button-row"><button className="secondary" onClick={() => setRotation(value => (value + 1) % 6)}>↻ 旋转 60°</button><button className="secondary" onClick={() => setFlip(value => !value)}>⇆ 镜像{flip ? ' ✓' : ''}</button></div>
        <dl className="facts"><div><dt>锚点</dt><dd>{anchor.q}, {anchor.r}</dd></div><div><dt>面积</dt><dd>{shape.length} 格</dd></div><div><dt>费用</dt><dd>{cost} 资金</dd></div><div><dt>建造后</dt><dd>{credits - cost} 资金</dd></div></dl>
        <div className={`validation ${reason ? 'bad' : 'good'}`} role="status">{reason ?? '✓ 可以建造，与现有建筑相邻。'}</div>
        <button className="primary full" disabled={Boolean(reason)} onClick={() => {
          if (reason) return;
          setPlacements(previous => [...previous, shape.map(hex => ({ q: hex.q + anchor.q, r: hex.r + anchor.r }))]);
          setCredits(value => value - cost);
        }}>确认建造 · {cost} ◈</button>
        <button className="text-button" disabled={placements.length <= 1} onClick={() => {
          const previous = placements.at(-1)!;
          setPlacements(value => value.slice(0, -1));
          setCredits(value => value + previous.length * 2);
        }}>撤销上一次建造</button>
      </aside>
    </div>
  </div>;
}
