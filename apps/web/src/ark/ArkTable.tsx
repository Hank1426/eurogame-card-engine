import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { applyCommand, forkSessionAt, visibleEvents } from '@eurogame/engine-core';
import {
  arkGame, arkActor, chooseArkCommand, ACTION_NAMES, ZOO_CARDS, ARK_LIMITATIONS,
  zooCard, ABILITY_LABELS, sponsorDescription, BUILDING_NAMES, buildingCells, animalCost,
  housingError, reputationRange, PROJECT_REWARD_NAMES, FINAL_CARDS,
  donationCost, projectDescription, buildingUsedSpace, projectRewardsFor,
  housingCapacity, mapCells, requirementError, canFlock, BASIC_BUILDING_KINDS,
  type ArkCommand, type ArkSession, type BuildingKind
} from '@eurogame/game-ark-nova';
import { ArkCard } from './ArkCard.js';
import { ArkMap } from './ArkMap.js';
import { ArkIcon } from './ArkIcon.js';
import { ArkArtwork } from './ArkArtwork.js';
import { ArkRequirements } from './ArkRequirements.js';
import { ArkOverview } from './ArkOverview.js';
import { ArkPlayers } from './ArkPlayers.js';
import { ArkOpeningGoals } from './ArkOpeningGoals.js';
import { ArkAssociation } from './ArkAssociation.js';
import { useArkAssets } from './asset-store.js';
import { legalBuildAnchors, placementKey, placementOptions, recommendedPlacements, type BuildCommand } from './placement-model.js';
import { useActionMotion } from './table-motion.js';
import { hexKey } from '@eurogame/mechanisms';
import './ark.css';
import './ark-experience.css';
import './ark-information.css';

export function ArkTable({ session, onSessionChange }: { session: ArkSession; onSessionChange: Dispatch<SetStateAction<ArkSession | null>> }) {
  const art = useArkAssets();
  const assets = art.urls;
  const [selected, setSelected] = useState<{ id: string; source: 'hand' | 'market' | 'tableau' } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>('initial-enclosure');
  const [buildingKind, setBuildingKind] = useState<BuildingKind>('enclosure-1');
  const [anchor, setAnchor] = useState({ q: 0, r: 2 });
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [locked, setLocked] = useState(false);
  const hoverFrame = useRef<number | null>(null);
  const hoverTarget = useRef({ q: 0, r: 2 });
  const placementEpoch = useRef<string | null>(null);
  const [spendX, setSpendX] = useState(0);
  const [useDouble, setUseDouble] = useState(false);
  const [doubleCount, setDoubleCount] = useState(1);
  const [choiceSelection, setChoiceSelection] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [aiFailureRevision, setAiFailureRevision] = useState<number | null>(null);
  const [replayRevision, setReplayRevision] = useState<number | null>(null);
  const [coordinates, setCoordinates] = useState(false);
  const [journal, setJournal] = useState(false);
  const displayed = useMemo(() => replayRevision === null ? session : forkSessionAt(arkGame, session, replayRevision), [session, replayRevision]);
  const view = useMemo(() => arkGame.getPlayerView(displayed.state, 'p1'), [displayed]);
  const player = view.players[0]!;
  const actor = view.actor;
  const aiTurn = actor !== 'p1' && view.phase !== 'finished';
  const readOnly = aiTurn || replayRevision !== null || view.phase === 'finished';
  const context = view.context;
  const decision = useMemo(() => arkGame.getDecision(displayed.state, 'p1'), [displayed]);
  const pending = view.pending?.actor === 'p1' ? view.pending : null;
  const card = selected ? zooCard(selected.id) : null;
  const placements = useMemo(() => placementOptions(pending), [pending]);
  const freePlacement = placements.length > 0;
  const paidPlacement = Boolean(pending?.prompt.includes('工程师'));
  const allowedKinds = useMemo(() => [...new Set(placements.map(option => option.placement.kind))], [placements]);
  const activeKind = freePlacement && !allowedKinds.includes(buildingKind) ? allowedKinds[0]! : buildingKind;
  const placing = !readOnly && (freePlacement || context?.action === 'build' && !pending);
  const buildCommand: BuildCommand = { type: 'build', kind: activeKind, ...anchor, rotation, flip };
  const draft = placing ? buildingCells(activeKind, anchor, rotation, flip) : [];
  const freeByCells = useMemo(() => new Map(placements.map(option => [placementKey(option.placement), option])), [placements]);
  const selectedPlacement = freePlacement ? freeByCells.get(placementKey(buildCommand)) : undefined;
  const activeSelection = freePlacement ? locked && selectedPlacement ? [selectedPlacement.id] : [] : choiceSelection;
  const buildError = placing ? freePlacement ? selectedPlacement ? null : '此位置不可放置，请查看绿色落点或旋转建筑。' : arkGame.validateCommand(displayed.state, 'p1', buildCommand)?.message ?? null : null;
  const result = arkGame.getResult(displayed.state);
  const humanOptions = decision?.options ?? [];
  const associationOptions = humanOptions.map(option => option.command).filter((command): command is Extract<ArkCommand, { type: 'association' }> => command.type === 'association');
  const animalCommand: ArkCommand | null = selected && selected.source !== 'tableau' && card?.kind === 'animal'
    ? { type: 'animal', card: selected.id, source: selected.source, building: selectedBuilding ?? '' } : null;
  const sponsorCommand: ArkCommand | null = selected && selected.source !== 'tableau' && card?.kind === 'sponsor'
    ? { type: 'sponsor', card: selected.id, source: selected.source } : null;
  const playCommand = animalCommand ?? sponsorCommand;
  const playError = playCommand ? arkGame.validateCommand(displayed.state, 'p1', playCommand)?.message ?? null : null;
  const log = visibleEvents(displayed.events, 'p1').slice(-50).reverse();
  const building = player.buildings.find(building => building.id === selectedBuilding);
  const anchors = useMemo(() => {
    if (!placing) return [];
    if (!freePlacement) return legalBuildAnchors(displayed.state, 'p1', activeKind, rotation, flip);
    return mapCells(player.map).filter(cell => freeByCells.has(placementKey({ type: 'build', kind: activeKind, q: cell.q, r: cell.r, rotation, flip }))).map(hexKey);
  }, [placing, freePlacement, displayed.state, activeKind, rotation, flip, freeByCells]);
  const beginCommands = useMemo(() => Object.fromEntries(player.row.map(action => {
    const doubles = useDouble ? Math.min(doubleCount, player.doubleTokens.filter(token => token === action).length) : 0;
    const command: Extract<ArkCommand, { type: 'begin' }> = { type: 'begin', action, spendX, useDouble: doubles > 0, ...(doubles ? { doubleCount: doubles } : {}) };
    return [action, { command, reason: arkGame.validateCommand(displayed.state, 'p1', command)?.message, doubles }];
  })), [displayed.state, spendX, useDouble, doubleCount]);
  const intentAction = !context && !pending && selected?.source !== 'tableau' && card?.kind !== 'project' ? card?.kind === 'animal' ? 'animals' : card?.kind === 'sponsor' ? 'sponsors' : null : null;
  const intentError = intentAction && card && selected ? requirementError(player, card.id)
    ?? (selected.source === 'market' && !player.upgrades.includes(intentAction) ? '从展示区打出需要对应行动 II。' : null)
    ?? (card.kind === 'animal' && selected.source !== 'tableau' && animalCost(displayed.state, player, card.id, selected.source) > player.money ? '当前资金不足以安置这只动物。' : null)
    ?? (card.kind === 'animal' && !canFlock(player, card.id) && !player.buildings.some(building => !housingError(building, card.id, player.map, player.sponsors.includes('219'))) ? '没有满足容量与地形要求的饲养区。' : null)
    ?? beginCommands[intentAction]!.reason ?? null : null;
  const actionMotion = useActionMotion(player.row, replayRevision === null);

  useEffect(() => {
    if (!placing) return;
    const epoch = `${freePlacement ? pending!.id : `${view.turns}-${context?.played}`}:${activeKind}`;
    if (placementEpoch.current === epoch) return;
    placementEpoch.current = epoch;
    setLocked(false);
    if (freePlacement) {
      const first = placements.find(option => option.placement.kind === activeKind)!.placement;
      setAnchor({ q: first.q, r: first.r }); setRotation(first.rotation); setFlip(first.flip);
    } else {
      const defaults = new Set(legalBuildAnchors(displayed.state, 'p1', activeKind, 0, false));
      const first = mapCells(player.map).find(cell => defaults.has(hexKey(cell)));
      if (first) setAnchor({ q: first.q, r: first.r });
      setRotation(0); setFlip(false);
    }
  }, [placing, freePlacement, pending?.id, view.turns, context?.played, activeKind]);
  useEffect(() => () => { if (hoverFrame.current !== null) window.cancelAnimationFrame(hoverFrame.current); }, []);
  useEffect(() => {
    if (!placing) return;
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, select, textarea, [contenteditable=true]') || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); setRotation(value => (value + 1) % 6); }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); setFlip(value => !value); }
      if (event.key === 'Escape') { event.preventDefault(); setLocked(false); setAnchor(hoverTarget.current); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [placing]);
  useEffect(() => { setChoiceSelection([]); }, [view.pending?.id]);
  useEffect(() => {
    if (replayRevision !== null || session.state.phase === 'finished' || arkActor(session.state) === 'p1' || aiFailureRevision === session.state.revision) return;
    const timer = setTimeout(() => {
      try {
        const actor = arkActor(session.state);
        const decision = arkGame.getDecision(session.state, actor);
        if (!decision) throw new Error('AI 没有可执行的决策。');
        const command = chooseArkCommand(arkGame.getPlayerView(session.state, actor), decision);
        const outcome = applyCommand(arkGame, session, { id: `ai-${session.branch.id}-${session.state.revision}`, actor, revision: session.state.revision, command });
        if (!outcome.ok) throw new Error(outcome.error.message);
        onSessionChange(current => current === session ? outcome.session : current);
      } catch (failure) {
        setAiFailureRevision(session.state.revision);
        setError(`AI 暂停：${failure instanceof Error ? failure.message : '未知错误'}，当前状态保留。`);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [session, replayRevision, aiFailureRevision, onSessionChange]);

  function send(command: ArkCommand) {
    if (readOnly) return;
    const outcome = applyCommand(arkGame, session, {
      id: `human-${session.branch.id}-${session.state.revision}`, actor: 'p1', revision: session.state.revision, command
    });
    if (!outcome.ok) { setError(outcome.error.message); return; }
    const keepCard = command.type === 'begin' && selected && (card?.kind === 'animal' && command.action === 'animals' || card?.kind === 'sponsor' && command.action === 'sponsors');
    setError(''); setSpendX(0); setUseDouble(false); setDoubleCount(1); setLocked(false);
    if (!keepCard) setSelected(null);
    onSessionChange(outcome.session);
  }
  function previewCell(q: number, r: number) {
    hoverTarget.current = { q, r };
    if (locked) return;
    if (hoverFrame.current !== null) return;
    hoverFrame.current = window.requestAnimationFrame(() => {
      hoverFrame.current = null;
      setAnchor(previous => previous.q === hoverTarget.current.q && previous.r === hoverTarget.current.r ? previous : hoverTarget.current);
    });
  }
  function lockCell(q: number, r: number) {
    if (hoverFrame.current !== null) window.cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = null;
    hoverTarget.current = { q, r };
    setAnchor({ q, r }); setLocked(true);
  }
  function recommend(command: BuildCommand) {
    setBuildingKind(command.kind); setAnchor({ q: command.q, r: command.r }); setRotation(command.rotation); setFlip(command.flip); setLocked(true);
    placementEpoch.current = `${pending!.id}:${command.kind}`;
  }
  function choose(id: string) {
    setChoiceSelection(previous => previous.includes(id) ? previous.filter(candidate => candidate !== id) : pending?.max === 1 ? [id] : [...previous, id].slice(-pending!.max));
  }
  function inspect(id: string, source: 'hand' | 'market' | 'tableau') {
    setSelected({ id, source });
    if (zooCard(id).kind === 'animal') {
      if (canFlock(player, id)) { setSelectedBuilding('flock'); return; }
      const building = player.buildings.find(building => !housingError(building, id, player.map, player.sponsors.includes('219')));
      if (building) setSelectedBuilding(building.id);
    }
  }
  const choices = pending && <div className={`ark-choice-options ${pending.kind === 'setup' ? 'starting-hand' : ''}`}>{freePlacement ? recommendedPlacements(placements).map((option, index) =>
    <button className={`ark-choice-option ${selectedPlacement?.id === option.id && locked ? 'selected' : ''}`} key={option.id} onClick={() => recommend(option.placement)}>建议位置 {index + 1}<small>{BUILDING_NAMES[option.placement.kind]} · {option.placement.q},{option.placement.r}</small></button>) : pending.options.map(option =>
    option.card && !FINAL_CARDS.some(card => card.id === option.card)
      ? <div className="ark-choice-card" key={option.id}><ArkCard id={option.card} assets={assets} selected={choiceSelection.includes(option.id)} onClick={() => choose(option.id)} />{option.id.startsWith('dig-') && <small>{option.label}</small>}</div>
      : <button className={`ark-choice-option ${choiceSelection.includes(option.id) ? 'selected' : ''}`} key={option.id} aria-pressed={choiceSelection.includes(option.id)} onClick={() => choose(option.id)}>
        {option.card && <span>✦ 终局卡</span>}{option.label}<small>{choiceSelection.includes(option.id) ? '✓ 已选' : '点击选择'}</small>
      </button>)}</div>;

  return <div className="ark-table" data-testid="ark-table">
    <header className="ark-game-heading"><div><span className="ark-title-mark">A</span><h1>方舟动物园 <small>地图 {player.map} · 双人实验版</small></h1></div>
      <div className="ark-heading-links"><a href="#/ark-rules">游戏规则 ↗</a><a href="#/assets" title={art.catalog.source.notice}>{art.loading ? '资源加载中' : art.catalog.referenceAvailable ? '本地美术已连接' : '内置美术'}</a><button className="text-button" aria-expanded={journal} onClick={() => setJournal(value => !value)}>日志与回放</button><details><summary>支持范围</summary><div><p>{ZOO_CARDS.filter(card => card.kind === 'animal').length} 动物 / {ZOO_CARDS.filter(card => card.kind === 'sponsor').length} 赞助商 / 32 保护项目 / 11 终局卡</p>{ARK_LIMITATIONS.map(limit => <p key={limit}>{limit}</p>)}<p>规则 {arkGame.manifest.rulesVersion}</p><p>{assets.tiles ? '本地参考素材 · 不进入公开构建' : '独立示意图 · 未加载本地参考素材'}</p></div></details></div>
    </header>
    <div className="ark-table-status">
      <span className={`ark-turn-pill ${aiTurn ? 'thinking' : ''}`} data-testid="ark-turn-status">{replayRevision !== null ? `历史回放 · 修订 ${replayRevision}` : result ? '对局结束' : aiTurn ? 'AI 正在思考…' : pending ? pending.prompt : '轮到你行动'}</span>
      <span>第 {view.turns + 1} 回合</span>
      <span className="ark-break-track" title={`已休息 ${view.breaks} 次`}>☕ 休息 <progress value={view.breakProgress} max={9} /><b data-testid="ark-break">{view.breakProgress}/9</b></span>
      <span className="ark-revision">种子 {session.seed} · 修订 <b data-testid="ark-revision">{view.revision}</b></span>
    </div>
    {error && <div className="error-banner ark-floating-error" role="alert"><span>{error}</span>{aiFailureRevision !== null ? <button className="secondary" onClick={() => { setAiFailureRevision(null); setError(''); }}>重试 AI</button> : <button aria-label="关闭错误" onClick={() => setError('')}>×</button>}</div>}
    <div className={`ark-play-layout ${view.stage === 'setup' ? 'is-setup' : ''}`}>
      {view.stage === 'setup' ? <ArkOpeningGoals view={view} assets={assets} /> : <section className="ark-market-section" aria-label="公共展示区"><div className="ark-strip-heading"><strong>公共展示区</strong><small>牌库 {view.deckCount} · 弃牌 {view.discardCount} · 声望可达 {reputationRange(player.reputation)}</small></div>
        <div className="ark-market" data-testid="ark-market">{view.market.map((id, index) => <div className={`ark-display-slot ${index < reputationRange(player.reputation) ? 'in-range' : ''}`} key={index}>
          <span className="ark-slot-label" title={index < reputationRange(player.reputation) ? '声望范围内' : '需要精选或更高声望'}>{index + 1}</span>
          {id ? <ArkCard id={id} assets={assets} selected={selected?.id === id} onClick={() => inspect(id, 'market')} compact /> : <div className="ark-card-back">{view.stage === 'setup' ? '选牌后翻开' : '回合结束补牌'}</div>}
        </div>)}</div>
      </section>}
      <div className={`ark-board-columns ${pending?.kind === 'setup' ? 'has-setup' : ''}`}>
        <div className="ark-map-with-rewards">
          <div className="ark-edge-rewards" aria-label="保护项目边缘奖励">{projectRewardsFor(player).map(reward => <div className={player.projectRewards.includes(reward) ? 'activated' : ''} title={PROJECT_REWARD_NAMES[reward]} key={reward}><b>{player.projectRewards.includes(reward) ? '✓' : reward === 'free-2' ? '⬡2' : reward === 'income-cp' ? '⬟1' : reward === 'income-5' ? '◈5' : reward === 'worker' ? '♟+' : reward === 'money-12' ? '◈12' : reward === 'x-3' ? 'X3' : reward === 'income-sponsor' ? '◈◇' : reward === 'draw-2' ? '▤2' : '▤↗'}</b></div>)}</div>
          <ArkMap player={player} draft={draft} valid={!buildError} onCell={lockCell} selectedBuilding={selectedBuilding} onBuilding={setSelectedBuilding} showCoordinates={coordinates} assets={assets}
            {...(placing ? { interaction: { locked, rotation, flip, anchors, onHover: previewCell, onRotate: () => setRotation(value => (value + 1) % 6), onFlip: () => setFlip(value => !value), onUnlock: () => { setLocked(false); setAnchor(hoverTarget.current); } } } : {})}
            {...(card?.kind === 'animal' && selected?.source !== 'tableau' ? { animal: card.id } : {})} />
        </div>
        {pending?.kind === 'setup' ? <section className="ark-setup-surface panel" aria-label="起手选牌"><div className="ark-mini-heading"><strong>规划你的第一座动物园</strong><small>点选 4 张保留，在右侧确认</small></div>{choices}</section>
          : <ArkOverview view={view} assets={assets} inspect={inspect} />}
      </div>
      <section className="ark-hand-section"><div className="ark-strip-heading"><strong>{pending?.kind === 'setup' ? '已选起手' : '你的手牌'} <small>{pending?.kind === 'setup' ? choiceSelection.length : player.handCount}</small></strong><small>悬停放大 · 点击操作 · 休息上限 {player.universities.includes('hand') ? 5 : 3}</small></div>
        <div className={view.stage === 'setup' ? 'ark-kept-cards' : 'ark-hand'} data-testid="ark-hand">{view.stage === 'setup'
          ? <>{(pending?.kind === 'setup' ? player.hand.filter(id => choiceSelection.includes(id)) : player.hand).map(id => <button key={id} disabled={readOnly} onClick={() => choose(id)} aria-label={`取消保留 ${zooCard(id).name}`}><ArkIcon name={zooCard(id).tags[0] ?? 'conservation'} assets={assets} />{zooCard(id).name}<span>×</span></button>)}{pending?.kind === 'setup' && !choiceSelection.length && <p className="muted">在中间选牌区选择要保留的 4 张卡。</p>}</>
          : <>{player.hand.map(id => <ArkCard key={id} id={id} assets={assets} selected={selected?.id === id} onClick={() => inspect(id, 'hand')} />)}{!player.hand.length && <p className="muted">暂无手牌。执行卡牌行动，或升级行动后使用展示区。</p>}</>}</div>
      </section>
      <section className="ark-action-dock" aria-label="方舟五行动"><div ref={actionMotion} className="ark-five-actions" data-testid="ark-actions">{player.row.map((action, index) => {
        const { command: begin, reason, doubles } = beginCommands[action]!;
        return <article data-action={action} className={`ark-action-card ${action} ${context?.action === action ? 'current' : ''}`} key={action}>
          <span className="ark-action-strength">{index + 1}{spendX > 0 && <small>+{spendX}</small>}{view.constriction.p1?.includes(action) && <small className="ark-token-constriction">−2</small>}</span>
          {view.venom.p1?.includes(action) && <span className="ark-token-venom" title="毒液：执行此卡可移除毒液，否则回合末支付 2 资金">毒</span>}
          <button className="ark-action-main" aria-label={`选择${ACTION_NAMES[action]}行动`} title={reason ?? `${ACTION_NAMES[action]}，强度 ${index + 1 + spendX}`} disabled={readOnly || Boolean(reason)} onClick={() => send(begin)}><ArkIcon name={action} assets={assets} /><strong>{ACTION_NAMES[action]}{player.doubleTokens.includes(action) ? ' ×2' : ''}</strong><small>{player.upgrades.includes(action) ? 'II' : 'I'}</small></button>
          <button className="ark-take-x" disabled={readOnly || Boolean(context) || Boolean(pending) || player.x >= 5} onClick={() => send({ type: 'take-x', action, useDouble: doubles > 0, ...(doubles ? { doubleCount: doubles } : {}) })}>{doubles ? `消耗 ${doubles} 双重 · +${doubles + 1} X` : '改为获得 X'}</button>
        </article>;
      })}</div></section>
      <aside className="ark-control-column" aria-label="固定操作区">
        <ArkPlayers view={view} assets={assets} />
        <div className="ark-control-state"><span className="eyebrow">{aiTurn ? 'AI TURN' : pending ? 'DECISION' : context ? 'ACTION' : 'YOUR TURN'}</span><strong>{aiTurn ? 'AI 正在行动' : freePlacement ? '在地图上放置奖励建筑' : pending ? '完成当前选择' : context ? `${ACTION_NAMES[context.action]} ${context.upgraded ? 'II' : 'I'} · 剩余 ${context.remaining}` : '选择行动或点击手牌'}</strong><div className="ark-operation-steps" aria-label="操作步骤"><span className={context || pending ? 'done' : 'current'}>1 行动</span><i>›</i><span className={context || pending ? 'current' : ''}>2 目标</span><i>›</i><span className={selected || locked || activeSelection.length ? 'current' : ''}>3 确认</span></div></div>
        <div className="ark-control-scroll">
          {pending ? <section className="ark-choice-panel"><h2 data-testid="ark-choice-prompt">{pending.prompt}</h2><p className="muted">选择 {pending.min === pending.max ? pending.min : `${pending.min}–${pending.max}`} 项 · 已选 {activeSelection.length} 项</p>
            {pending.kind === 'setup' ? <><p className="muted">先看上方公共动保和自己的终局目标，再选 4 张起手牌。起始资金 25，兼顾动物费用与建造费用。</p><p className="ark-choice-tip">绿色边框表示保留；再次点击取消。悬停卡牌查看完整效果，右下确认后开始。</p></> : freePlacement ? <><p className="muted">绿色圆点是可放位置。移动鼠标预览，点击地图锁定，再在右下方确认。</p><label htmlFor="ark-free-building-kind">奖励建筑</label><select id="ark-free-building-kind" value={activeKind} onChange={event => { setBuildingKind(event.target.value as BuildingKind); setLocked(false); }}>{allowedKinds.map(kind => <option key={kind} value={kind}>{BUILDING_NAMES[kind]}</option>)}</select><p className="ark-map-hint">R 旋转 · {activeKind.startsWith('unique-') ? '独有建筑不可镜像' : 'F 镜像'} · Esc 解锁 · 费用 {paidPlacement ? draft.length * 2 : 0}</p>{choices}</> : choices}
          </section> : context?.action === 'build' ? <section className="ark-detail">
            <h2>规划建筑</h2><label htmlFor="ark-building-kind">建筑类型</label><select id="ark-building-kind" value={buildingKind} onChange={event => { setBuildingKind(event.target.value as BuildingKind); setLocked(false); }}>{BASIC_BUILDING_KINDS.map(kind => <option key={kind} value={kind}>{BUILDING_NAMES[kind]}</option>)}</select>
            <div className="button-row ark-build-tools"><button className="secondary" onClick={() => setRotation(value => (value + 1) % 6)}>↻ 旋转</button><button className="secondary" onClick={() => setFlip(value => !value)}>⇆ 镜像{flip ? ' ✓' : ''}</button></div>
            <p className="muted">移动预览，点击锁定位置。R 旋转、F 镜像、Esc 解锁。绿色圆点是当前朝向的合法落点。</p>
            <div className="ark-build-cost"><span><ArkIcon name="enclosure" />{draft.length} 格</span><span><ArkIcon name="money" />{draft.length * 2}</span><span>余额 {player.money - draft.length * 2}</span></div>
            <p className="ark-map-hint">贩售亭是店铺图案；紫灰色立体石堆是岩石。只有共边的地形计入动物条件。</p>
          </section> : card && selected ? <section className="ark-detail">
            <div className="ark-detail-title"><span className={`ark-kind-label ${card.kind}`}>{card.kind === 'animal' ? '动物' : card.kind === 'project' ? '保护项目' : '赞助商'} / {card.id}</span><button className="text-button" aria-label="取消查看" onClick={() => setSelected(null)}>×</button></div>
            <h2>{card.name}</h2><div className="ark-detail-art"><ArkArtwork id={card.id} assets={assets} /></div>
            <div className="ark-detail-tags">{card.tags.map((tag, index) => <ArkIcon name={tag} assets={assets} key={`${tag}-${index}`} />)}{card.appeal > 0 && <span><ArkIcon name="appeal" assets={assets} />{card.appeal}</span>}{card.conservation > 0 && <span><ArkIcon name="conservation" />{card.conservation}</span>}{card.reputation > 0 && <span><ArkIcon name="reputation" assets={assets} />{card.reputation}</span>}</div>
            <p className="ark-card-effect">{card.kind === 'animal' ? card.abilities.map(ability => `${ABILITY_LABELS[ability.key]}${ability.value !== 1 ? ` ${ability.value}` : ''}`).join('；') || '安置后获得卡面收益。' : card.kind === 'project' ? projectDescription(card.id) : sponsorDescription(card.id)}</p>
            {selected.source !== 'tableau' && <><span className="ark-field-label">打出条件 <small>✓ 满足 / × 未满足 · 悬停查看</small></span><ArkRequirements card={card} player={player} state={displayed.state} source={selected.source} assets={assets} {...(building ? { building } : {})} /></>}
            {card.kind === 'animal' && selected.source !== 'tableau' && <>
              <label htmlFor="ark-housing">饲养区 · 可直接点地图选择</label><select id="ark-housing" value={selectedBuilding ?? ''} onChange={event => setSelectedBuilding(event.target.value)}><option value="">请选择</option>{canFlock(player, card.id) && <option value="flock">群居 · 使用已有食草动物空间，不占新饲养区</option>}{player.buildings.filter(building => !building.kind.startsWith('unique-') && building.kind !== 'kiosk' && building.kind !== 'pavilion').map(building => <option value={building.id} key={building.id}>{BUILDING_NAMES[building.kind]}{housingCapacity(building, player.map) > building.cells.length ? `（容量 ${housingCapacity(building, player.map)}）` : ''} · {buildingUsedSpace(building) > 0 ? '占用' : '闲置'}{housingError(building, card.id, player.map, player.sponsors.includes('219')) ? ' · 条件未满足' : ' · ✓ 可安置'} · {building.id}</option>)}</select>
              <p className="ark-map-hint">相邻水域与岩石已在地图圈出；贩售亭不计作岩石。</p>
              <div className="ark-price-line"><ArkIcon name="money" />{animalCost(displayed.state, player, card.id, selected.source)}<small>支付后 {player.money - animalCost(displayed.state, player, card.id, selected.source)}</small></div>
            </>}
            {card.kind === 'project' && <p className="muted">通过协会行动选择此项目，再选择等级与奖励。</p>}
          </section> : context?.action === 'association' ? <section className="ark-detail"><h2>选择协会任务</h2><ArkAssociation options={associationOptions} disabled={readOnly} send={send} /></section>
            : <section className="ark-detail ark-next-move"><h2>{context ? `执行${ACTION_NAMES[context.action]}` : '让动物园生长。'}</h2>
              <p className="muted">{context?.action === 'animals' ? '点击底部动物手牌，条件和费用将显示在这里。' : context?.action === 'cards' ? '点击展示牌后拿取，或从牌库抓牌。' : context?.action === 'sponsors' ? '点击赞助商手牌打出，或推动休息获得资金。' : '五行动所在槽位决定强度。选中卡牌、预览条件，再在这里确认。'}</p>
              <div className="ark-howto"><span>1</span>底部选择行动<span>2</span>地图或手牌选目标<span>3</span>右侧确认并结算</div>
              <div className="ark-legend-guide"><ArkIcon name="kiosk" /><span>店铺是贩售亭<br /><small>不满足岩石条件</small></span><ArkIcon name="rock" /><span>石堆是岩石<br /><small>需与饲养区共边</small></span></div>
              <a href="#/ark-rules" className="text-button">五行动与获胜规则 ↗</a>
            </section>}
          {context?.action === 'association' && selected && !pending && <ArkAssociation options={associationOptions} disabled={readOnly} send={send} />}
        </div>
        <div className="ark-confirm-area" data-testid="ark-confirm-area">
          {freePlacement && <div className={`validation ${buildError ? 'bad' : 'good'}`} role="status">{buildError ?? (locked ? `✓ 位置已锁定，可以确认${paidPlacement ? '付费' : '免费'}放置。` : '移动鼠标预览，点击地图锁定位置。')}</div>}
          {!pending && context?.action === 'build' && <div className={`validation ${buildError ? 'bad' : 'good'}`} role="status">{buildError ?? '✓ 位置合法，可以建造。'}</div>}
          {!pending && context?.action !== 'build' && playCommand && <div className={`validation ${(intentAction ? intentError : playError) ? 'bad' : 'good'}`} role="status">{intentAction ? intentError ?? `开始${ACTION_NAMES[intentAction]}行动后，即可确认这张卡。` : playError ?? '✓ 满足条件，可以打出。'}</div>}
          {!context && !pending && <><label className="ark-x-control">增强强度 · 使用 X<input aria-label="使用 X 标记" type="number" min={0} max={player.x} value={spendX} disabled={readOnly} onChange={event => setSpendX(Math.max(0, Math.min(player.x, Number(event.target.value))))} /></label>{player.doubleTokens.length > 0 && <><label className="ark-check-label"><input type="checkbox" checked={useDouble} onChange={event => setUseDouble(event.target.checked)} />使用对应行动上的双重标记</label>{useDouble && <label className="ark-x-control">最多消耗双重标记<input aria-label="消耗双重标记数量" type="number" min={1} max={Math.max(...player.row.map(action => player.doubleTokens.filter(token => token === action).length))} value={doubleCount} onChange={event => setDoubleCount(Math.max(1, Math.min(player.doubleTokens.length, Number(event.target.value))))} /></label>}</>}</>}
          {pending && <button className="primary full" aria-label="确认选择" disabled={readOnly || activeSelection.length < pending.min || activeSelection.length > pending.max || freePlacement && (!locked || !selectedPlacement)} onClick={() => send({ type: 'resolve', choiceId: pending.id, options: activeSelection })}>{freePlacement ? paidPlacement ? `确认放置 · ${draft.length * 2} 资金` : '确认免费放置' : `确认选择${activeSelection.length > 0 ? ` · ${activeSelection.length}` : ''}`}</button>}
          {freePlacement && pending && pending.min === 0 && <button className="secondary full" onClick={() => send({ type: 'resolve', choiceId: pending.id, options: [] })} disabled={readOnly}>跳过建造</button>}
          {context?.action === 'build' && !pending && <button className="primary full" disabled={readOnly || Boolean(buildError)} onClick={() => send(buildCommand)}>确认建造</button>}
          {intentAction && <button className="primary full" disabled={readOnly || Boolean(intentError)} onClick={() => send(beginCommands[intentAction]!.command)}>开始{ACTION_NAMES[intentAction]}行动</button>}
          {card && selected?.source !== 'tableau' && playCommand && !pending && context && context.action !== 'build' && <button className="primary full" disabled={readOnly || Boolean(playError)} onClick={() => send(playCommand)}>{card.kind === 'animal' ? '确认安置动物' : '确认打出赞助商'}</button>}
          {selected?.source === 'market' && context?.action === 'cards' && !pending && humanOptions.filter(option => (option.command.type === 'draw' || option.command.type === 'snap') && option.command.card === selected.id).map(option => <button className="primary full" key={option.id} disabled={readOnly} onClick={() => send(option.command)}>{option.command.type === 'snap' ? '精选此展示牌' : '抓取此展示牌'}</button>)}
          {context?.action === 'cards' && !pending && <button className="primary full" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'draw', source: 'deck', card: '' }))} onClick={() => send({ type: 'draw', source: 'deck', card: '' })}>从牌库抓 1 张</button>}
          {context?.action === 'sponsors' && !pending && <button className="secondary full" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'income' }))} onClick={() => send({ type: 'income' })}>休息 +{context.strength} · 领取 {context.strength * (context.upgraded ? 2 : 1)} 资金</button>}
          {context?.action === 'association' && !pending && <><button className="primary full" type="submit" form="ark-association-form" disabled={readOnly || !associationOptions.length}>确认协会任务</button><button className="secondary full" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'donate' }))} onClick={() => send({ type: 'donate' })}>捐赠 {donationCost(view.donations)} 资金</button></>}
          {context && !pending && <button className="secondary full" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'finish' }))} onClick={() => send({ type: 'finish' })}>结束本次行动</button>}
          <small>{aiTurn ? 'AI 自动完成行动，无需切换座位' : pending ? '选择已暂存，确认后继续结算' : context ? '操作与确认固定在此处' : '先选择行动，强度从左到右递增'}</small>
        </div>
      </aside>
    </div>
    {result && <section className="ark-result panel" data-testid="ark-result"><span className="eyebrow">FINAL SCORING</span><h2>{result.winners.length === 2 ? '双方共享胜利' : result.winners.includes('p1') ? '你的动物园获胜' : '林野动物园 AI 获胜'}</h2><p>{result.scores.map(score => `${view.players.find(player => player.id === score.player)!.name}：${score.points} 分（魅力 ${score.appeal} / 保护 ${score.conservation} / 项目 ${score.projects}）`).join('；')}</p><a className="secondary" href="#/lobby">再来一局</a><button className="text-button" onClick={() => { setJournal(true); }}>查看回放</button></section>}
    {journal && <div className="ark-journal-shade" onClick={() => setJournal(false)} />}
    <details className="ark-log panel" open={journal} onToggle={event => setJournal(event.currentTarget.open)}><summary>对局日志与回放 · {displayed.commands.length} 步</summary><button className="text-button ark-close-journal" onClick={() => setJournal(false)}>关闭</button>
      <div className="replay-tools"><label htmlFor="ark-replay">回放修订</label><input id="ark-replay" type="range" min={0} max={session.state.revision} value={replayRevision ?? session.state.revision} onChange={event => setReplayRevision(Number(event.target.value))} /><span>{replayRevision ?? session.state.revision}/{session.state.revision}</span><button className="text-button" disabled={replayRevision === null} onClick={() => { setReplayRevision(null); }}>返回当前对局</button></div>
      <label className="ark-check-label"><input type="checkbox" checked={coordinates} onChange={event => setCoordinates(event.target.checked)} />显示地图坐标</label>
      <div className="ark-log-entries">{log.map((entry, index) => <button key={`${entry.revision}-${index}`} onClick={() => { setReplayRevision(entry.revision); setJournal(false); }}><span>#{entry.revision}</span>{entry.message}</button>)}</div>
    </details>
  </div>;
}
