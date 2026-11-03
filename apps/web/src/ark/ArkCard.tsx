import { ABILITY_LABELS, TAG_NAMES, zooCard, sponsorDescription, projectDescription } from '@eurogame/game-ark-nova';
import { ArkArtwork } from './ArkArtwork.js';
import { ArkIcon } from './ArkIcon.js';
import { ArkRequirements } from './ArkRequirements.js';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArkCardPreview } from './ArkCardPreview.js';

export const TAG_SYMBOLS: Record<string, string> = { predator: '🐾', herbivore: '♞', primate: '♟', reptile: '◇', bird: '🪽', bear: '●', pet: '♡', africa: 'AF', americas: 'AM', australia: 'AU', asia: 'AS', europe: 'EU', science: '⚗' };
export function ArkCard({ id, assets, selected = false, onClick, compact = false, staticConditions = false }: {
  id: string; assets: Record<string, string>; selected?: boolean; onClick: () => void; compact?: boolean; staticConditions?: boolean;
}) {
  const card = zooCard(id);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, setPreview] = useState<{ left: number; top: number } | null>(null);
  const tooltipId = useId();
  function closePreview() { if (timer.current) clearTimeout(timer.current); setPreview(null); }
  function schedulePreview(delay = 180) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 310;
      const height = Math.min(470, window.innerHeight - 28);
      const left = rect.right + width + 16 < window.innerWidth ? rect.right + 10 : Math.max(10, rect.left - width - 10);
      setPreview({ left, top: Math.max(12, Math.min(rect.top, window.innerHeight - height - 12)) });
    }, delay);
  }
  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', closePreview, true);
    window.addEventListener('resize', closePreview);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', closePreview, true); window.removeEventListener('resize', closePreview); };
  }, [preview]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <><button ref={button} className={`ark-card ${card.kind} ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}`} onClick={() => { closePreview(); onClick(); }} aria-label={`查看 ${card.name}`} aria-pressed={selected} aria-describedby={preview ? tooltipId : undefined}
    onPointerEnter={event => { if (event.pointerType !== 'touch') schedulePreview(); }} onPointerLeave={closePreview} onPointerDown={closePreview} onFocus={() => schedulePreview(100)} onBlur={closePreview}>
    <div className="ark-card-art"><ArkArtwork id={id} assets={assets} />
      <div className="ark-card-stat">{card.kind === 'animal' ? <><span>⬡ {card.size}</span><span>{card.price} ◈</span></> : <span>{card.kind === 'project' ? '⬟ 保护项目' : `强度 ${card.strength}`}</span>}</div>
      <span className="ark-card-number">{card.id}</span>
    </div>
    <div className="ark-card-name">{card.name}</div>
    <div className="ark-card-tags">{card.tags.map((tag, index) => <span key={`${tag}-${index}`} title={TAG_NAMES[tag]}><ArkIcon name={tag} assets={assets} /></span>)}</div>
    <ArkRequirements card={card} assets={assets} useGuide={!staticConditions} />
    {!compact && <p>{card.kind === 'animal' ? card.abilities.length ? card.abilities.map(ability => `${ABILITY_LABELS[ability.key]}${typeof ability.value === 'number' && ability.value > 1 ? ` ${ability.value}` : ''}`).join('；') : '满足条件并支付费用后安置，获得卡面收益。' : card.kind === 'project' ? projectDescription(id) : sponsorDescription(id)}</p>}
    <div className="ark-card-rewards"><span>{card.appeal > 0 ? `♟ ${card.appeal}` : ''}</span><span>{card.conservation > 0 ? `⬟ ${card.conservation}` : ''}</span><span>{card.reputation > 0 ? `◆ ${card.reputation}` : ''}</span></div>
  </button>{preview && createPortal(<ArkCardPreview id={id} assets={assets} tooltipId={tooltipId} staticConditions={staticConditions} {...preview} />, document.body)}</>;
}
