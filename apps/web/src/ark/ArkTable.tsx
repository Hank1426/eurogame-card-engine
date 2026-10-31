import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { applyCommand, forkSessionAt, visibleEvents } from '@eurogame/engine-core';
import {
  arkGame, arkActor, chooseArkCommand, ACTION_NAMES, ZOO_CARDS, ARK_LIMITATIONS,
  zooCard, TAG_NAMES, ABILITY_LABELS, sponsorDescription, BUILDING_NAMES, buildingCells,
  animalCost, housingError, appealIncome, victoryScore, crossingAppeal, reputationRange, availableWorkers,
  tagsOf, projectById, projectMetric, PROJECT_REWARD_NAMES, UNIVERSITY_NAMES, FINAL_CARDS, donationCost,
  type ArkCommand, type ArkSession, type BuildingKind
} from '@eurogame/game-ark-nova';
import { SectionHeading } from '@eurogame/ui-kit';
import { ArkCard, TAG_SYMBOLS } from './ArkCard.js';
import { ArkMap } from './ArkMap.js';
import './ark.css';

const actionSymbols = { animals: '🐾', build: '⬡', cards: '▤', association: '♟', sponsors: '◈' };
const stageNames = { setup: '起手选牌', turn: '选择行动', action: '行动进行中', break: '休息结算', scoring: '终局计分', finished: '对局结束' };

export function ArkTable({ session, onSessionChange }: { session: ArkSession; onSessionChange: Dispatch<SetStateAction<ArkSession | null>> }) {
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{ id: string; source: 'hand' | 'market' | 'tableau' } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>('initial-enclosure');
  const [buildingKind, setBuildingKind] = useState<BuildingKind>('enclosure-1');
  const [anchor, setAnchor] = useState({ q: 0, r: 2 });
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [spendX, setSpendX] = useState(0);
  const [choiceSelection, setChoiceSelection] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [aiFailureRevision, setAiFailureRevision] = useState<number | null>(null);
  const [replayRevision, setReplayRevision] = useState<number | null>(null);
  const [coordinates, setCoordinates] = useState(false);
  const displayed = useMemo(() => replayRevision === null ? session : forkSessionAt(arkGame, session, replayRevision), [session, replayRevision]);
  const view = useMemo(() => arkGame.getPlayerView(displayed.state, 'p1'), [displayed]);
  const player = view.players[0]!;
  const other = view.players[1]!;
  const actor = view.actor;
  const aiTurn = actor !== 'p1' && view.phase !== 'finished';
  const readOnly = aiTurn || replayRevision !== null || view.phase === 'finished';
  const context = view.context;
  const decision = useMemo(() => arkGame.getDecision(displayed.state, 'p1'), [displayed]);
  const pending = view.pending?.actor === 'p1' ? view.pending : null;
  const card = selected ? zooCard(selected.id) : null;
  const draft = context?.action === 'build' && !pending ? buildingCells(buildingKind, anchor, rotation, flip) : [];
  const buildCommand: ArkCommand = { type: 'build', kind: buildingKind, ...anchor, rotation, flip };
  const buildError = draft.length ? arkGame.validateCommand(displayed.state, 'p1', buildCommand)?.message ?? null : null;
  const result = arkGame.getResult(displayed.state);
  const humanOptions = decision?.options ?? [];
  const associationOptions = humanOptions.filter(option => option.command.type === 'association');
  const animalCommand: ArkCommand | null = selected && selected.source !== 'tableau' && card?.kind === 'animal'
    ? { type: 'animal', card: selected.id, source: selected.source, building: selectedBuilding ?? '' } : null;
  const sponsorCommand: ArkCommand | null = selected && selected.source !== 'tableau' && card?.kind === 'sponsor'
    ? { type: 'sponsor', card: selected.id, source: selected.source } : null;
  const playCommand = animalCommand ?? sponsorCommand;
  const playError = playCommand ? arkGame.validateCommand(displayed.state, 'p1', playCommand)?.message ?? null : null;
  const log = visibleEvents(displayed.events, 'p1').slice(-35).reverse();

  useEffect(() => {
    let active = true;
    void fetch('/__ark_reference__/manifest.json').then(response => response.ok ? response.json() as Promise<Record<string, string>> : {}).then(manifest => {
      if (active) setAssets(manifest);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => { setChoiceSelection([]); }, [view.pending?.id]);
  useEffect(() => {
    if (!context || view.activePlayer !== 'p1' || replayRevision !== null || pending) return;
    const target = context.action === 'cards' ? '.ark-market-section' : context.action === 'association' ? '.ark-association' : '.ark-board-columns';
    const frame = window.requestAnimationFrame(() => document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [context?.action, view.activePlayer, replayRevision]);
  useEffect(() => {
    if (!selected || pending) return;
    const frame = window.requestAnimationFrame(() => document.querySelector('.ark-board-columns')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [selected?.id]);
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
    setError(''); setSpendX(0); setSelected(null);
    onSessionChange(outcome.session);
  }
  function choose(id: string) {
    setChoiceSelection(previous => previous.includes(id) ? previous.filter(candidate => candidate !== id) : pending?.max === 1 ? [id] : [...previous, id].slice(-pending!.max));
  }
  function inspect(id: string, source: 'hand' | 'market' | 'tableau') {
    setSelected({ id, source });
    if (zooCard(id).kind === 'animal') {
      const building = player.buildings.find(building => !housingError(building, id));
      if (building) setSelectedBuilding(building.id);
    }
  }

  return <div className="ark-table" data-testid="ark-table">
    <header className="ark-game-heading"><div><span className="eyebrow">ARK NOVA / TWO-PLAYER TABLE</span><h1>方舟动物园 <span>地图 A · 你与 AI</span></h1></div><div className="ark-heading-links"><a href="#/ark-rules">游戏规则 ↗</a><button className="text-button" onClick={() => document.querySelector('.ark-board-columns')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看地图</button><button className="text-button" onClick={() => document.querySelector('.ark-hand-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>查看手牌</button><details><summary>首版支持范围</summary><p>{ZOO_CARDS.filter(card => card.kind === 'animal').length} 张动物 / {ZOO_CARDS.filter(card => card.kind === 'sponsor').length} 张赞助商 / 12 种基础项目 / 11 张终局卡。</p>{ARK_LIMITATIONS.map(limit => <p key={limit}>{limit}</p>)}</details></div></header>
    <div className="ark-table-status"><span className={`ark-turn-pill ${aiTurn ? 'thinking' : ''}`} data-testid="ark-turn-status">{replayRevision !== null ? `历史回放 · 修订 ${replayRevision}` : result ? '对局结束' : aiTurn ? 'AI 正在思考…' : pending ? pending.prompt : '轮到你行动'}</span><span>{stageNames[view.stage]}</span><span>第 {view.turns + 1} 回合</span><span>已休息 {view.breaks} 次</span><span className="ark-revision">种子 {session.seed} · 修订 <b data-testid="ark-revision">{view.revision}</b></span></div>
    {error && <div className="error-banner" role="alert"><span>{error}</span>{aiFailureRevision !== null ? <button className="secondary" onClick={() => { setAiFailureRevision(null); setError(''); }}>重试 AI</button> : <button aria-label="关闭错误" onClick={() => setError('')}>×</button>}</div>}
    {result && <section className="ark-result panel" data-testid="ark-result"><span>✦</span><div><span className="eyebrow">FINAL SCORING</span><h2>{result.winners.length === 2 ? '双方共享胜利' : result.winners.includes('p1') ? '你的动物园获胜' : '林野动物园 AI 获胜'}</h2><p>{result.scores.map(score => `${view.players.find(player => player.id === score.player)!.name}：${score.points} 分（魅力 ${score.appeal} / 保护 ${score.conservation} / 支持项目 ${score.projects}）`).join('；')}</p></div><a className="secondary" href="#/lobby">再来一局</a></section>}
    <section className="ark-tracks panel" aria-label="公共计分轨道">
      <div className="ark-track-legend"><strong>魅力与保护 · 两条轨道相遇触发终局</strong><span>♟ 魅力 →</span><span>← ⬟ 保护</span>{view.finalTurns !== null && <b>最后 {view.finalTurns} 个回合</b>}</div>
      {view.players.map(candidate => <div className={`ark-track-row ${candidate.id}`} key={candidate.id}><span className="ark-track-name">{candidate.id === 'p1' ? '你' : 'AI'} <small>{victoryScore(candidate.appeal, candidate.conservation)} 分</small></span><div className="ark-score-rail">
        <span className="ark-appeal-fill" style={{ width: `${candidate.appeal / 114 * 100}%` }} /><span className="ark-conservation-fill" style={{ left: `${Math.max(0, crossingAppeal(candidate.conservation)) / 114 * 100}%` }} />
        <span className="ark-score-token appeal-token" style={{ left: `${Math.min(97, candidate.appeal / 114 * 100)}%` }}>♟{candidate.appeal}</span>
        <span className="ark-score-token conservation-token" style={{ left: `${Math.min(97, Math.max(0, crossingAppeal(candidate.conservation)) / 114 * 100)}%` }}>⬟{candidate.conservation}</span>
      </div><span className="ark-track-income">收入 {appealIncome(candidate.appeal)} ◈</span></div>)}
      <div className="ark-public-bottom"><div className="ark-reputation-track"><span>你的声望 ◆ {player.reputation}</span>{Array.from({ length: 15 }, (_, index) => <i key={index} className={index + 1 <= player.reputation ? 'reached' : ''}>{index + 1}</i>)}</div><div className="ark-break-track"><span>☕ 休息</span>{Array.from({ length: 9 }, (_, index) => <i key={index} className={index < view.breakProgress ? 'reached' : ''} />)}<b data-testid="ark-break">{view.breakProgress}/9</b></div></div>
    </section>
    <section className="ark-market-section"><SectionHeading eyebrow="PUBLIC DISPLAY" title="公共展示区" extra={<span className="tiny">牌库 {view.deckCount} · 弃牌 {view.discardCount} · 当前声望可访问 {reputationRange(player.reputation)} 号以内</span>} />
      <div className="ark-market" data-testid="ark-market">{view.market.map((id, index) => <div className={`ark-display-slot ${index < reputationRange(player.reputation) ? 'in-range' : ''}`} key={index}><div className="ark-slot-label"><span>{index + 1}</span><small>{index < reputationRange(player.reputation) ? '声望范围内' : '精选可获取'}</small></div>
        {id ? <ArkCard id={id} assets={assets} selected={selected?.id === id} onClick={() => inspect(id, 'market')} compact /> : <div className="ark-card-back">{view.stage === 'setup' ? '设置结束后翻开' : '回合结束后补充'}</div>}
      </div>)}</div>
    </section>
    {pending && <section className="ark-choice-panel panel" aria-label="当前选择"><div className="section-heading"><div><span className="eyebrow">RESOLVE YOUR DECISION</span><h2 data-testid="ark-choice-prompt">{pending.prompt}</h2><p className="tiny">选择 {pending.min === pending.max ? pending.min : `${pending.min}–${pending.max}`} 项 · 已选 {choiceSelection.length} 项</p></div><button className="primary" disabled={readOnly || choiceSelection.length < pending.min || choiceSelection.length > pending.max} onClick={() => send({ type: 'resolve', choiceId: pending.id, options: choiceSelection })}>确认选择</button></div>
      <div className={`ark-choice-options ${pending.kind === 'setup' ? 'starting-hand' : ''}`}>{pending.options.map(option => option.card && !FINAL_CARDS.some(card => card.id === option.card) ? <ArkCard key={option.id} id={option.card} assets={assets} selected={choiceSelection.includes(option.id)} onClick={() => choose(option.id)} /> :
        <button className={`ark-choice-option ${choiceSelection.includes(option.id) ? 'selected' : ''}`} key={option.id} aria-pressed={choiceSelection.includes(option.id)} onClick={() => choose(option.id)}>{option.card && FINAL_CARDS.some(card => card.id === option.card) && <span>✦ 终局卡</span>}{option.label}<small>{choiceSelection.includes(option.id) ? '✓ 已选' : '点击选择'}</small></button>)}</div>
    </section>}
    <div className="ark-board-columns"><div className="ark-zoo-column">
      <section className="ark-resource-bar panel" aria-label="你的动物园资源"><div><strong>你的动物园</strong><span>地图 A</span></div><div><span>资金</span><b data-testid="ark-money">{player.money} ◈</b></div><div><span>魅力</span><b>{player.appeal} ♟</b></div><div><span>保护</span><b>{player.conservation} ⬟</b></div><div><span>X 标记</span><b>{player.x} ✳</b></div><div><span>事务员</span><b>{availableWorkers(player)}/{player.workers} ♟</b></div></section>
      <div className="ark-map-with-rewards"><div className="ark-edge-rewards"><span>保护项目<br />边缘奖励</span>{Object.entries(PROJECT_REWARD_NAMES).map(([reward, label]) => <div className={player.projectRewards.includes(reward) ? 'activated' : ''} title={label} key={reward}>{player.projectRewards.includes(reward) ? '✓' : '●'}<small>{reward === 'free-2' ? '免费 2 格' : reward === 'income-cp' ? '⬟ 1 收入' : reward === 'income-5' ? '◈ 5 收入' : reward === 'money-12' ? '◈ 12' : reward === 'x-3' ? 'X 3' : reward === 'draw-2' ? '抓 2 张' : '拿牌收入'}</small></div>)}</div><ArkMap player={player} draft={draft} valid={!buildError} onCell={(q, r) => setAnchor({ q, r })} selectedBuilding={selectedBuilding} onBuilding={setSelectedBuilding} showCoordinates={coordinates} /></div>
      <div className="ark-player-partners"><span>合作动物园：</span>{player.partners.length ? player.partners.map(tag => <b key={tag}>{TAG_SYMBOLS[tag]} {TAG_NAMES[tag]}</b>) : <small>尚无</small>}<span>大学：</span>{player.universities.map(university => <b title={UNIVERSITY_NAMES[university]} key={university}>{university === 'science' ? '⚗×2' : university === 'hand' ? '▤5 ◆1' : '⚗ ◆2'}</b>)}</div>
      <section className="ark-tableau panel"><SectionHeading eyebrow="YOUR ZOO" title="已安置动物与赞助商" extra={<span className="tiny">动物 {player.animals.length} · 赞助商 {player.sponsors.length}</span>} /><div className="ark-tableau-cards">{[...player.animals, ...player.sponsors].length ? [...player.animals, ...player.sponsors].map(id => <button key={id} onClick={() => inspect(id, 'tableau')}><span>{zooCard(id).kind === 'animal' ? '🐾' : '◈'}</span>{zooCard(id).name}</button>) : <p className="muted">先规划饲养区，再安置动物；赞助商会逐步建立你的经营引擎。</p>}</div><div className="ark-tag-summary">{Object.entries(tagsOf(player)).filter(([, count]) => count > 0).map(([tag, count]) => <span key={tag}>{TAG_NAMES[tag]} {count}</span>)}</div></section>
    </div><aside className="ark-side-column">
      <section className="ark-association panel"><SectionHeading eyebrow="ASSOCIATION BOARD" title="动物园协会" extra={<span className="tiny">可用工人 {availableWorkers(player)}</span>} /><div className="ark-association-tasks"><div><b>2</b><span>声望 +2</span></div><div><b>3</b><span>合作动物园</span></div><div><b>4</b><span>合作大学</span></div><div><b>{player.sponsors.includes('203') ? 4 : 5}</b><span>保护项目</span></div></div><div className="ark-supply"><span>合作动物园供应</span><div>{view.partnerSupply.map(tag => <i key={tag}>{TAG_SYMBOLS[tag]}</i>)}</div></div><div className="ark-supply"><span>大学供应</span><div>{view.universitySupply.map(id => <i title={UNIVERSITY_NAMES[id]} key={id}>{id === 'science' ? '⚗⚗' : id === 'hand' ? '▤5' : '⚗◆'}</i>)}</div></div><div className="ark-donation-label">升级协会后可捐赠 · 下一格 {donationCost(view.donations)} 资金</div>
      </section>
      <section className="ark-detail panel">
        {context?.action === 'build' && !pending ? <><span className="eyebrow">BUILD PREVIEW</span><h2>规划建筑</h2><label htmlFor="ark-building-kind">建筑类型</label><select id="ark-building-kind" value={buildingKind} onChange={event => setBuildingKind(event.target.value as BuildingKind)}>{Object.entries(BUILDING_NAMES).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><div className="button-row"><button className="secondary" onClick={() => setRotation(value => (value + 1) % 6)}>↻ 旋转</button><button className="secondary" onClick={() => setFlip(value => !value)}>⇆ 镜像{flip ? ' ✓' : ''}</button></div><p className="muted">点击地图空地选择位置，绿色表示可以确认。</p><dl className="facts"><div><dt>剩余强度</dt><dd>{context.remaining}</dd></div><div><dt>面积 / 费用</dt><dd>{draft.length} 格 / {draft.length * 2} 资金</dd></div><div><dt>建造后资金</dt><dd>{player.money - draft.length * 2}</dd></div><div><dt>锚点</dt><dd>{anchor.q}, {anchor.r}</dd></div></dl><div className={`validation ${buildError ? 'bad' : 'good'}`} role="status">{buildError ?? '✓ 位置合法，可以建造。'}</div><button className="primary full" disabled={readOnly || Boolean(buildError)} onClick={() => send(buildCommand)}>确认建造</button></> :
          card && selected ? <><span className="eyebrow">{card.kind === 'animal' ? 'ANIMAL DETAILS' : 'SPONSOR DETAILS'}</span><h2>{card.name}</h2><div className="ark-detail-art">{assets[card.id] ? <img src={assets[card.id]} alt="" /> : <span>{TAG_SYMBOLS[card.tags[0] ?? 'science'] ?? '⌁'}</span>}</div><p>{card.kind === 'animal' ? card.abilities.map(ability => `${ABILITY_LABELS[ability.key]}${ability.value !== 1 ? ` ${ability.value}` : ''}`).join('；') || '没有额外能力，安置后获得卡面收益。' : sponsorDescription(card.id)}</p><div className="ark-requirements"><strong>打出条件</strong><span>{card.requirements.map(requirement => requirement === 'Partner Zoo' ? '对应大洲合作动物园' : requirement === 'animalsII' ? '动物 II' : TAG_NAMES[requirement] ?? requirement).join('、') || '无额外图标条件'}</span></div>
            {card.kind === 'animal' && <><dl className="facts"><div><dt>最低饲养区</dt><dd>{card.tags.includes('pet') ? '萌宠园' : `${card.size} 格`}</dd></div><div><dt>地形要求</dt><dd>水域 {card.water} / 岩石 {card.rock}</dd></div><div><dt>当前费用</dt><dd>{selected.source === 'tableau' ? '已支付' : animalCost(displayed.state, player, card.id, selected.source)} 资金</dd></div><div><dt>安置收益</dt><dd>♟ {card.appeal} / ⬟ {card.conservation} / ◆ {card.reputation}</dd></div></dl><label htmlFor="ark-housing">选择饲养区（也可点击地图建筑）</label><select id="ark-housing" value={selectedBuilding ?? ''} onChange={event => setSelectedBuilding(event.target.value)}><option value="">请选择</option>{player.buildings.filter(building => building.kind.startsWith('enclosure') || building.kind === 'petting').map(building => <option value={building.id} key={building.id}>{BUILDING_NAMES[building.kind]} · {building.animals.length ? '已占用' : '闲置'} · {building.id}</option>)}</select></>}
            {selected.source !== 'tableau' && <><div className={`validation ${playError ? 'bad' : 'good'}`}>{playError ?? '✓ 满足条件，可以打出。'}</div><button className="primary full" disabled={readOnly || Boolean(playError) || !playCommand} onClick={() => { if (playCommand) send(playCommand); }}>{card.kind === 'animal' ? '确认安置动物' : '确认打出赞助商'}</button>
              {selected.source === 'market' && context?.action === 'cards' && <div className="ark-card-acquire">{humanOptions.filter(option => (option.command.type === 'draw' || option.command.type === 'snap') && option.command.card === selected.id).map(option => <button className="secondary full" key={option.id} disabled={readOnly} onClick={() => send(option.command)}>{option.command.type === 'snap' ? '精选此展示牌' : '抓取此展示牌'}</button>)}</div>}</>}
            <button className="text-button" onClick={() => setSelected(null)}>取消查看</button>
          </> : <><span className="eyebrow">YOUR NEXT MOVE</span><h2>{context ? `执行${ACTION_NAMES[context.action]}` : '一张行动，一次抉择。'}</h2><p className="muted">五张行动卡所在位置决定强度。选择右侧更强的行动，完成后它会回到槽位 1。</p><p className="muted">点击手牌或展示牌查看条件与费用；建造时在地图上预览旋转与镜像。</p>
            {(context?.action === 'animals' || context?.action === 'sponsors') && <div className="ark-quick-hand"><strong>从手牌选择{context.action === 'animals' ? '动物' : '赞助商'}</strong>{player.hand.filter(id => zooCard(id).kind === (context.action === 'animals' ? 'animal' : 'sponsor')).map(id => <button className="secondary full" key={id} onClick={() => inspect(id, 'hand')}>{zooCard(id).name}<small>{zooCard(id).kind === 'animal' ? `${zooCard(id).price} 资金 · ${zooCard(id).size} 格` : `等级 ${zooCard(id).strength}`}</small></button>)}</div>}
            <a className="text-button" href="#/ark-rules">查看五行动与获胜规则 ↗</a></>}
      </section>
      <section className="ark-opponent panel"><div><span className="avatar small p2">AI</span><strong>{other.name}</strong></div><p>◈ {other.money} · ♟ {other.appeal} · ⬟ {other.conservation} · ◆ {other.reputation}</p><p>手牌 {other.handCount} · 动物 {other.animals.length} · 事务员 {availableWorkers(other)}/{other.workers}</p><div className="ark-opponent-row">{other.row.map(action => <span key={action} title={ACTION_NAMES[action]}>{actionSymbols[action]}{other.upgrades.includes(action) ? 'II' : 'I'}</span>)}</div></section>
    </aside></div>
    <section className="ark-projects"><SectionHeading eyebrow="BASE CONSERVATION PROJECTS" title="基础保护项目" extra={<span className="tiny">双人局每张封锁一个等级 · 每人每项目仅支持一次</span>} /><div className="ark-project-grid">{view.projects.map(current => {
      const project = projectById(current.id);
      return <article className="ark-project-card panel" key={current.id}><header><span>⬟</span><h3>{project.name}</h3><small>你已有 {projectMetric(player, project.tag)} 图标</small></header><div className="ark-project-tiers">{project.thresholds.map((threshold, tier) => <div className={current.blocked === tier ? 'blocked' : current.claimed[tier] ? `claimed ${current.claimed[tier]}` : ''} key={tier}><strong>{threshold} {TAG_NAMES[project.tag]}</strong><span>⬟ {project.points[tier]}</span><small>{current.blocked === tier ? '双人封锁' : current.claimed[tier] === 'p1' ? '你已支持' : current.claimed[tier] ? 'AI 已支持' : '可竞争'}</small></div>)}</div></article>;
    })}</div></section>
    <section className="ark-hand-section"><SectionHeading eyebrow="YOUR HAND" title={view.stage === 'setup' ? '起手卡牌 · 上方选择保留 4 张' : '你的手牌'} extra={<span className="tiny">当前 {player.handCount} 张 · 休息时上限 {player.universities.includes('hand') ? 5 : 3} 张</span>} /><div className="ark-hand" data-testid="ark-hand">{player.hand.map(id => <ArkCard key={id} id={id} assets={assets} selected={selected?.id === id} onClick={() => inspect(id, 'hand')} />)}{!player.hand.length && <p className="muted">暂无手牌，可执行卡牌行动，或使用升级行动直接从展示区打出。</p>}</div></section>
    <section className="ark-final-cards panel"><span>✦ 你的秘密终局目标</span>{player.finals.map(id => { const final = FINAL_CARDS.find(card => card.id === id)!; return <div key={id}><strong>{final.name}</strong><small>{final.thresholds.length ? `达成 ${final.thresholds.join(' / ')}，获得 1 / 2 / 3 / 4 保护点` : final.metric === 'architecture' ? '连接全部水域 / 全部岩石 / 覆盖边界 / 覆盖地图，各 1 点' : '每一种动物图标多于对手，获得 1 点，最多 4 点'}</small></div>; })}</section>
    <section className="ark-action-dock" aria-label="方舟五行动"><div className="ark-action-instructions"><div><span className="eyebrow">{aiTurn ? 'AI IS PLAYING' : pending ? 'CHOICE REQUIRED' : context ? 'ACTION IN PROGRESS' : 'SELECT YOUR ACTION'}</span><strong>{aiTurn ? 'AI 正在自动完成行动与选择' : pending ? pending.prompt : context ? `${ACTION_NAMES[context.action]} ${context.upgraded ? 'II' : 'I'} · 剩余额度 ${context.remaining}` : '选择五行动之一，或移动任意行动卡获得 1 枚 X'}</strong></div><div className="ark-action-controls">
      {!context && !pending && <label>增强强度 · 使用 X<input aria-label="使用 X 标记" type="number" min={0} max={player.x} value={spendX} disabled={readOnly} onChange={event => setSpendX(Math.max(0, Math.min(player.x, Number(event.target.value))))} /></label>}
      {context?.action === 'cards' && !pending && <button className="primary" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'draw', source: 'deck', card: '' }))} onClick={() => send({ type: 'draw', source: 'deck', card: '' })}>从牌库抓 1 张</button>}
      {context?.action === 'sponsors' && !pending && <button className="primary" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'income' }))} onClick={() => send({ type: 'income' })}>休息 +{context.strength} · 领取 {context.strength * (context.upgraded ? 2 : 1)} 资金</button>}
      {context?.action === 'association' && !pending && <button className="secondary" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'donate' }))} onClick={() => send({ type: 'donate' })}>捐赠 {donationCost(view.donations)} 资金</button>}
      {context && !pending && <button className="secondary" disabled={readOnly || Boolean(arkGame.validateCommand(displayed.state, 'p1', { type: 'finish' }))} onClick={() => send({ type: 'finish' })}>结束本次行动</button>}
    </div></div>
      {context?.action === 'association' && !pending && <div className="ark-association-options">{associationOptions.map(option => {
        const command = option.command;
        if (command.type !== 'association') return null;
        const label = command.task === 'reputation' ? '声望 +2' : command.task === 'partner' ? `${TAG_NAMES[command.target]}合作动物园` : command.task === 'university' ? UNIVERSITY_NAMES[command.target] : `支持${projectById(command.target).name} · ⬟${projectById(command.target).points[command.tier]} · ${PROJECT_REWARD_NAMES[command.reward]}`;
        return <button className="secondary" key={option.id} disabled={readOnly} onClick={() => send(command)}>{label}</button>;
      })}</div>}
      <div className="ark-five-actions" data-testid="ark-actions">{player.row.map((action, index) => {
        const begin: ArkCommand = { type: 'begin', action, spendX };
        const reason = arkGame.validateCommand(displayed.state, 'p1', begin)?.message;
        return <article className={`ark-action-card ${action} ${context?.action === action ? 'current' : ''}`} key={action}><span className="ark-action-strength">{index + 1}{spendX ? <small>+{spendX}</small> : null}</span><button className="ark-action-main" aria-label={`选择${ACTION_NAMES[action]}行动`} title={reason ?? `${ACTION_NAMES[action]}，强度 ${index + 1 + spendX}`} disabled={readOnly || Boolean(reason)} onClick={() => send(begin)}><span>{actionSymbols[action]}</span><strong>{ACTION_NAMES[action]}</strong><small>{player.upgrades.includes(action) ? '等级 II' : '等级 I'}</small></button><button className="ark-take-x" disabled={readOnly || Boolean(context) || Boolean(pending) || player.x >= 5} onClick={() => send({ type: 'take-x', action })}>改为获得 X</button></article>;
      })}</div>
    </section>
    <details className="ark-log panel"><summary>对局日志与回放 · {displayed.commands.length} 步</summary><div className="replay-tools"><label htmlFor="ark-replay">回放修订</label><input id="ark-replay" type="range" min={0} max={session.state.revision} value={replayRevision ?? session.state.revision} onChange={event => setReplayRevision(Number(event.target.value))} /><span>{replayRevision ?? session.state.revision}/{session.state.revision}</span><button className="text-button" disabled={replayRevision === null} onClick={() => setReplayRevision(null)}>返回当前对局</button></div><label className="ark-coordinate-toggle"><input type="checkbox" checked={coordinates} onChange={event => setCoordinates(event.target.checked)} /> 显示地图坐标</label><div className="ark-log-entries">{log.map((entry, index) => <button key={`${entry.revision}-${index}`} onClick={() => setReplayRevision(entry.revision)}><span>#{entry.revision}</span>{entry.message}</button>)}</div></details>
  </div>;
}
