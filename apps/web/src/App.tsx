import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { applyCommand, createSession, exportArchive, forkSessionAt, importArchive, visibleEvents } from '@eurogame/engine-core';
import { getCard, arkReferenceSchema, referenceCardName, type ArkReference } from '@eurogame/content';
import { arkCoverage, arkGame, type ArkSession } from '@eurogame/game-ark-nova';
import { demoGame, createChoiceScenario, createEndgameScenario, currentActor, playCost, type DemoCommand, type DemoSession } from '@eurogame/game-demo';
import { chooseDemoCommand } from '@eurogame/game-demo/ai';
import { BotanicalArt, LeafMark, ResourceCounter, SectionHeading } from '@eurogame/ui-kit';
import { CardTile, familyLabels } from './CardTile.js';
import { LayoutLab } from './LayoutLab.js';
import { readSave, writeSave } from './storage.js';
import { MatchLobby, type MatchSettings } from './MatchLobby.js';
import { RulesPage } from './RulesPage.js';
const ArkTable = lazy(async () => ({ default: (await import('./ark/ArkTable.js')).ArkTable }));
const ArkRules = lazy(async () => ({ default: (await import('./ark/ArkRules.js')).ArkRules }));

declare const __BUILD_SHA__: string;
const navigation = [
  { id: 'lobby', symbol: '⌂', label: '创建对局', caption: 'NEW GAME' },
  { id: 'table', symbol: '◈', label: '对局工作台', caption: 'PLAY & EXPLORE' },
  { id: 'ark', symbol: '⬟', label: '方舟牌桌', caption: 'ARK NOVA' },
  { id: 'rules', symbol: '◇', label: '游戏规则', caption: 'HOW TO PLAY' },
  { id: 'layout', symbol: '⬡', label: '建造交互实验', caption: 'SPATIAL LAB' },
  { id: 'coverage', symbol: '◎', label: '方舟规则进度', caption: 'RULE COVERAGE' },
  { id: 'catalog', symbol: '▤', label: '本地参考卡库', caption: 'LOCAL REFERENCE' }
];
const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败。';
const HUMAN_PLAYER = 'p1';
const AI_DELAY_MS = 650;

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function App() {
  const [route, setRoute] = useState(window.location.hash.slice(2) || 'lobby');
  const [session, setSession] = useState<DemoSession | null>(null);
  const [arkSession, setArkSession] = useState<ArkSession | null>(null);
  const [arkStorageBlocked, setArkStorageBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storageStatus, setStorageStatus] = useState('正在读取本地存档');
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [recoveryArchive, setRecoveryArchive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [seed, setSeed] = useState('42');
  const [scenario, setScenario] = useState('normal');
  const [selected, setSelected] = useState<{ instanceId: string; source: 'hand' | 'market' | 'tableau' } | null>(null);
  const [replayRevision, setReplayRevision] = useState<number | null>(null);
  const [reference, setReference] = useState<ArkReference | null>(null);
  const [search, setSearch] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [aiFailure, setAiFailure] = useState<{ revision: number; message: string } | null>(null);
  const viewer = HUMAN_PLAYER;
  const upload = useRef<HTMLInputElement>(null);
  const referenceUpload = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.slice(2) || 'lobby');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let alive = true;
    async function initialize() {
      let raw: string | null = null;
      try {
        raw = await readSave();
        const restored = raw ? importArchive(demoGame, raw) : null;
        if (!alive) return;
        setSession(restored);
        if (restored) setSeed(String(restored.seed));
      } catch (failure) {
        if (!alive) return;
        setStorageBlocked(true);
        setRecoveryArchive(raw);
        setError(`${messageOf(failure)} 已保留原存档。新建对局后才会替换它。`);
      }
      let rawArk: string | null = null;
      try {
        rawArk = await readSave('ark-current');
        if (rawArk && alive) setArkSession(importArchive(arkGame, rawArk));
      } catch (failure) {
        if (alive) {
          setArkStorageBlocked(true);
          setRecoveryArchive(rawArk);
          setError(`方舟存档恢复失败：${messageOf(failure)} 原始文件已保留。`);
        }
      } finally { if (alive) setLoading(false); }
    }
    void initialize();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!session || loading || storageBlocked) return;
    let alive = true;
    setStorageStatus('正在保存');
    void writeSave(exportArchive(session)).then(() => {
      if (alive) setStorageStatus('已自动保存在此浏览器');
    }).catch(failure => {
      if (alive) setStorageStatus(messageOf(failure));
    });
    return () => { alive = false; };
  }, [session, loading, storageBlocked]);

  useEffect(() => {
    if (!arkSession || loading || arkStorageBlocked) return;
    let alive = true;
    setStorageStatus('正在保存');
    void writeSave(exportArchive(arkSession), 'ark-current').then(() => {
      if (alive) setStorageStatus('已自动保存在此浏览器');
    }).catch(failure => { if (alive) setStorageStatus(messageOf(failure)); });
    return () => { alive = false; };
  }, [arkSession, loading, arkStorageBlocked]);

  useEffect(() => {
    if (!session || route !== 'table' || replayRevision !== null || session.state.phase === 'finished' ||
      currentActor(session.state) === HUMAN_PLAYER || aiFailure?.revision === session.state.revision) return;
    const timer = setTimeout(() => {
      try {
        const actor = currentActor(session.state);
        const decision = demoGame.getDecision(session.state, actor);
        if (!decision) throw new Error('AI 暂时没有可执行的操作。');
        const command = chooseDemoCommand(demoGame.getPlayerView(session.state, actor), decision);
        const outcome = applyCommand(demoGame, session, {
          id: `ai-${session.branch.id}-${session.state.revision}`,
          actor, revision: session.state.revision, command
        });
        if (!outcome.ok) throw new Error(outcome.error.message);
        setSession(current => current === session ? outcome.session : current);
      } catch (failure) {
        setAiFailure({ revision: session.state.revision, message: messageOf(failure) });
      }
    }, AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [session, route, replayRevision, aiFailure]);

  const displayed = useMemo(() => {
    if (!session) return null;
    return replayRevision === null ? session : forkSessionAt(demoGame, session, replayRevision);
  }, [session, replayRevision]);
  const view = displayed ? demoGame.getPlayerView(displayed.state, viewer) : null;
  const player = view?.players.find(candidate => candidate.id === viewer);
  const actor = displayed ? currentActor(displayed.state) : 'p1';
  const actorName = view?.players.find(candidate => candidate.id === actor)?.name ?? '';
  const result = displayed ? demoGame.getResult(displayed.state) : null;
  const aiTurn = Boolean(displayed && displayed.state.phase !== 'finished' && actor !== viewer);
  const isReadOnly = replayRevision !== null || aiTurn || Boolean(result);
  const selectionCard = selected ? getCard(selected.instanceId) : null;
  const selectionError = selected && displayed
    ? selected.source === 'tableau' ? '这张卡牌已经建设。'
      : demoGame.validateCommand(displayed.state, viewer, { type: 'play', instanceId: selected.instanceId, source: selected.source })?.message ?? null
    : null;
  const events = displayed ? visibleEvents(displayed.events, viewer).slice(-50).reverse() : [];

  function install(next: DemoSession) {
    setSession(next);
    setAiFailure(null);
    setSelected(null);
    setReplayRevision(null);
    setError('');
    setStorageBlocked(false);
    setRecoveryArchive(null);
    setSeed(String(next.seed));
  }

  function send(command: DemoCommand) {
    if (!session || isReadOnly) return;
    const outcome = applyCommand(demoGame, session, {
      id: `${session.branch.id}-${session.state.revision}`, actor: viewer,
      revision: session.state.revision, command
    });
    if (!outcome.ok) { setError(outcome.error.message); return; }
    setSession(outcome.session);
    setSelected(null);
    setError('');
  }

  function newGame() {
    const numericSeed = Number(seed);
    if (!/^\d+$/.test(seed) || !Number.isInteger(numericSeed) || numericSeed < 0 || numericSeed > 0xffff_ffff) {
      setError('种子应为 0–4294967295 的整数。');
      return;
    }
    install(scenario === 'choice' ? createChoiceScenario(numericSeed) : scenario === 'endgame'
      ? createEndgameScenario(numericSeed) : createSession(demoGame, { debug: true }, numericSeed));
  }

  function startMatch(settings: MatchSettings) {
    if (settings.game === 'ark-nova') {
      setArkSession(createSession(arkGame, { map: settings.map ?? 'A', playerCount: 2 }, settings.seed));
      setArkStorageBlocked(false);
      setError(''); setRecoveryArchive(null);
      window.location.hash = '/ark';
      return;
    }
    install(createSession(demoGame, { playerCount: settings.playerCount, debug: false }, settings.seed));
    setFocusMode(true);
    window.location.hash = '/table';
  }

  async function importSave(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('存档超过 5 MB 上限。');
      const text = await file.text();
      const metadata = JSON.parse(text) as { manifest?: { gameId?: string } };
      if (metadata.manifest?.gameId === 'ark-nova') {
        setArkSession(importArchive(arkGame, text));
        setArkStorageBlocked(false);
        setError('');
        window.location.hash = '/ark';
      } else {
        install(importArchive(demoGame, text));
        window.location.hash = '/table';
      }
    } catch (failure) {
      setError(`导入失败：${messageOf(failure)} 当前对局保持不变。`);
    }
  }

  async function importReference(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('参考资料超过 10 MB 上限。');
      setReference(arkReferenceSchema.parse(JSON.parse(await file.text())));
      setError('');
    } catch (failure) { setError(`资料包无效：${messageOf(failure)}`); }
  }

  if (loading) return <main className="loading"><LeafMark /><p>正在准备工作台…</p></main>;

  return <div className={`app-shell ${route === 'ark' && arkSession ? 'ark-focus' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="#/lobby"><span className="brand-mark"><LeafMark /></span><span>EUROGAME<small>ENGINE LAB</small></span></a>
      <div className="workspace-label">你的桌游实验室 <span>LOCAL</span></div>
      <nav aria-label="工作台导航">{navigation.map(item => <a key={item.id} href={`#/${item.id}`} aria-label={item.label} title={item.label} className={route === item.id ? 'active' : ''} aria-current={route === item.id ? 'page' : undefined}>
        <span className="nav-symbol">{item.symbol}</span><span>{item.label}<small>{item.caption}</small></span>
      </a>)}</nav>
      <div className="sidebar-note"><span className="eyebrow">BUILD SOMETHING PLAYABLE</span><p>从一次行动，<br />到一套可信的规则。</p><span className="tiny">确定性 · 可回放 · 可复用</span></div>
      <div className="sidebar-footer"><span className="status-dot" />本地工作台 · v0.1.0<small>构建 {__BUILD_SHA__}</small></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div><span className="breadcrumb">实验室 / {navigation.find(item => item.id === route)?.label ?? '创建对局'}</span><span className="pill subtle">首期实验版</span></div>
        <div className="topbar-actions"><a className="secondary small" href="#/lobby">＋ 创建对局</a><a className="text-button" href={route.startsWith('ark') ? '#/ark-rules' : '#/rules'}>游戏规则</a><span className="save-status" role="status"><span className="status-dot" />{storageBlocked || arkStorageBlocked ? '原存档保护中' : !session && !arkSession ? '准备好开始新对局' : storageStatus}</span>
          <button className="secondary small" onClick={() => upload.current?.click()}>↥ 导入存档</button>
          <button className="secondary small" disabled={route.startsWith('ark') ? !arkSession : !session} onClick={() => {
            if (route.startsWith('ark') && arkSession) download(exportArchive(arkSession), `ark-nova-${arkSession.seed}-r${arkSession.state.revision}.json`);
            else if (session) download(exportArchive(session), `garden-lab-${session.seed}-r${session.state.revision}.json`);
          }}>↧ 导出对局</button></div>
        <input ref={upload} type="file" accept=".json,application/json" className="visually-hidden" aria-label="导入对局文件" onChange={event => { void importSave(event.target.files?.[0]); event.target.value = ''; }} />
      </header>
      <main className="workspace-main">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="关闭提示">×</button></div>}
        {recoveryArchive && <button className="secondary" onClick={() => download(recoveryArchive, 'original-recovery.json')}>导出保留的原始存档</button>}
        {aiFailure && <div className="error-banner" role="alert"><span>AI 暂停：{aiFailure.message} 当前对局已保留。</span><button className="secondary small" onClick={() => setAiFailure(null)}>重试 AI</button></div>}
        {route === 'ark-rules' ? <Suspense fallback={<p className="muted">正在加载方舟规则…</p>}><ArkRules /></Suspense> : route === 'ark' && arkSession ? <Suspense fallback={<p className="muted">正在加载方舟牌桌…</p>}><ArkTable session={arkSession} onSessionChange={setArkSession} /></Suspense> : route === 'rules' ? <RulesPage hasMatch={Boolean(session)} /> : route === 'lobby' || (route === 'table' && !session) || (route === 'ark' && !arkSession) ? <MatchLobby
          currentMatch={session ? { playerCount: session.state.players.length, round: session.state.round, roundLimit: session.state.roundLimit, finished: session.state.phase === 'finished' } : null}
          arkMatch={arkSession ? { playerCount: 2, round: arkSession.state.turns + 1, roundLimit: 0, finished: arkSession.state.phase === 'finished', map: arkSession.config.map } : null}
          onStart={startMatch}
        /> : route === 'layout' ? <LayoutLab /> : route === 'coverage' ? <>
          <div className="page-intro"><span className="eyebrow">ARK NOVA / IMPLEMENTATION TRACKER</span><h1>让每一条规则，<br />都有据可查。</h1><p>资料覆盖、程序实现与人工复核分别记录。方舟首个可玩版已开放，仍使用限定牌池；完整基础版尚未验收。</p></div>
          <div className="coverage-counters">{arkCoverage.targets.map(target => <div className="panel coverage-counter" key={target.category}><span>{target.label}</span><strong>{arkCoverage.cards.filter(card => card.category === target.category && card.implemented).length}<small> / {target.expected}</small></strong><span className="tiny">规则实现数量</span></div>)}</div>
          <div className="panel coverage-panel"><SectionHeading eyebrow="RULE TRACEABILITY" title="双人基础版规则矩阵" extra={<span className="pill">地图 A / 0 / 1 / 2 · 阶段四</span>} />
            <table><thead><tr><th>规则</th><th>依据</th><th>实现进度</th></tr></thead><tbody>{arkCoverage.rules.map(rule => <tr key={rule.id}><td><strong>{rule.label}</strong><small>{rule.id}</small></td><td>{rule.source}</td><td><span className={`pill ${rule.status === 'tested' ? 'green' : 'subtle'}`}>{rule.status === 'tested' ? '已测试 · 待人工核对' : '尚未实现'}</span></td></tr>)}</tbody></table>
          </div>
        </> : route === 'catalog' ? <>
          <div className="page-intro"><span className="eyebrow">REFERENCE, WITH PROVENANCE</span><h1>资料有来源，<br />规则有边界。</h1><p>在本地导入参考仓库整理后的基础版数据。资料只在当前页面内展示，不上传服务器。</p></div>
          <div className="panel reference-panel"><SectionHeading eyebrow="NEXT ARK NOVA CARDS" title={reference ? `已载入 ${reference.cards.length} 张参考卡牌` : '加载你的本地参考资料'} extra={<button className="primary" onClick={() => referenceUpload.current?.click()}>导入参考资料</button>} />
            <input ref={referenceUpload} type="file" accept=".json" className="visually-hidden" aria-label="导入参考资料文件" onChange={event => { void importReference(event.target.files?.[0]); event.target.value = ''; }} />
            <p className="muted">先在仓库根目录执行 <code>pnpm content:import</code>，再选择 <code>content/private/ark-nova.reference.json</code>。</p>
            {reference ? <><div className="notice"><strong>数据已录入，规则未实现</strong><span>来源修订 {reference.source.commit.slice(0, 12)} · {reference.source.license}</span></div>
              <label className="search-label">搜索名称或编号<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="例如 401" /></label>
              <div className="reference-grid">{reference.cards.filter(card => `${card.id} ${card.name} ${referenceCardName(reference, card)}`.toLowerCase().includes(search.toLowerCase())).map(card => <article className="reference-card" key={card.id}><span className="eyebrow">{card.category} / {card.id}</span><h3>{referenceCardName(reference, card)}</h3><span className="pill subtle">资料参考 · 不可打出</span></article>)}</div>
            </> : <div className="reference-empty"><LeafMark /><h3>参考项目位于 references/</h3><p>完整参考数据通过本地文件加载，参考原图不加入静态构建。</p></div>}
          </div>
        </> : session && view && displayed && player ? <>
          {!focusMode && <section className="hero">
            <div><div className="hero-eyebrow"><span className="status-dot" />原创机制样例 · {view.players.length} 人 · {view.roundLimit} 轮 · AI 对战</div><h1>植序工坊<span>让好点子，长成一局游戏。</span></h1><p>经营一座微型生态工坊，用资源、卡牌与选择，验证你的下一套机制。</p></div>
            <div className="hero-seal"><BotanicalArt /><span>GARDEN LAB<small>01 / ORIGINAL SERIES</small></span></div>
          </section>}
          <div className="table-meta"><div className="round-progress"><span className="eyebrow">ROUND</span><strong data-testid="round">{view.round}<small> / {view.roundLimit}</small></strong><div className="round-dots">{Array.from({ length: view.roundLimit }, (_, index) => <span key={index} className={index < view.round ? 'filled' : ''} />)}</div></div>
            <span className="pill subtle">种子 {session.seed} · 修订 <span data-testid="revision">{displayed.state.revision}</span></span>
            <button className="text-button focus-toggle" aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>{focusMode ? '展开介绍' : '专注牌桌'}</button>
            <a className="text-button" href="#/rules">如何游玩 ↗</a>
            <span className="pill green" data-testid="turn-status">{replayRevision !== null ? `回放 · 修订 ${replayRevision}` : result ? '对局已结束' : aiTurn ? `AI ${actorName} 正在思考…` : '轮到你行动'}</span>
          </div>
          {result && <section className="result-banner" data-testid="result"><LeafMark /><div><span className="eyebrow">EXPERIMENT COMPLETE</span><h2>{result.winners.length > 1 ? '这一轮，共同生长。' : `${view.players.find(candidate => candidate.id === result.winners[0])!.name} 获胜`}</h2><p>{result.scores.map(score => `${view.players.find(candidate => candidate.id === score.player)!.name} ${score.points} 分`).join(' · ')}。平分并列；资金与能量不计入得分。</p></div></section>}
          <div className="table-columns">
            <div className="play-column">
              <section className="player-summary panel"><div className="player-identity"><span className={`avatar ${viewer}`}>你</span><div><span className="eyebrow">YOUR WORKSHOP</span><h2>{player.name} · 你</h2><span className="tiny">手牌 {player.handCount} · 已建设 {player.tableau.length}</span></div></div>
                <div className="resources"><ResourceCounter label="资金" value={player.resources.credits} symbol="◈" variant="credits" /><ResourceCounter label="能量" value={player.resources.energy} symbol="✧" variant="energy" /><ResourceCounter label="得分" value={player.resources.points} symbol="✦" variant="points" /></div>
              </section>
              <section className="market-section"><SectionHeading eyebrow="SHARED MARKET" title="公共展示区" extra={<span className="tiny">从这里建设需额外 1 资金 · 牌库 {view.deckCount}</span>} /><div className="card-grid market" data-testid="market">{view.market.map((id, index) => id ? <CardTile key={id} instanceId={id} selected={selected?.instanceId === id} onSelect={() => setSelected({ instanceId: id, source: 'market' })} compact /> : <div className="empty-card" key={`empty-${index}`}>展示位 {index + 1}<small>回合结束后补充</small></div>)}</div></section>
              <section className="hand-section"><SectionHeading eyebrow="YOUR POSSIBILITIES" title="手中的可能" extra={<span className="tiny">点击卡牌查看完整效果，再确认建设</span>} /><div className="card-grid hand" data-testid="hand">{player.hand.length ? player.hand.map(id => <CardTile key={id} instanceId={id} selected={selected?.instanceId === id} onSelect={() => setSelected({ instanceId: id, source: 'hand' })} />) : <div className="empty-state">暂无手牌，可以研究抽牌，或从公共展示区建设。</div>}</div></section>
              <section className="tableau-section"><SectionHeading eyebrow="GROWING SYSTEMS" title="已建设的生态" extra={<span className="tiny">每轮末自动结算收入</span>} /><div className="tableau-list">{player.tableau.length ? player.tableau.map(id => <button className="tableau-card" key={id} onClick={() => setSelected({ instanceId: id, source: 'tableau' })}><span>✦</span><strong>{getCard(id).name}</strong><small>查看效果 ↗</small></button>) : <div className="empty-tableau"><span>⌁</span>你的第一片生境，即将从这里生长。</div>}</div></section>
              <section className="opponent-strip panel" aria-label="AI 对手">{view.players.filter(candidate => candidate.id !== viewer).map(opponent => <div key={opponent.id} className={actor === opponent.id ? 'active-opponent' : ''}><span className={`avatar small ${opponent.id}`}>AI</span><strong>{opponent.name} · AI</strong><span>◈ {opponent.resources.credits}</span><span>✧ {opponent.resources.energy}</span><span>✦ {opponent.resources.points}</span><span className="muted">手牌 {opponent.handCount} · 已建设 {opponent.tableau.length}</span></div>)}</section>
            </div>
            <aside className="inspector">
              <section className="panel detail-panel"><span className="eyebrow">CARD INSPECTOR</span>
                {selectionCard && selected ? <><h2>{selectionCard.name}</h2><span className={`family-label ${selectionCard.family}`}>{familyLabels[selectionCard.family]}</span><BotanicalArt variant={selectionCard.family} /><p className="detail-description">{selectionCard.description}</p>
                  <dl className="facts"><div><dt>来源</dt><dd>{selected.source === 'hand' ? '你的手牌' : selected.source === 'market' ? '公共展示区' : '已建设区域'}</dd></div><div><dt>建设费用</dt><dd>{selected.source === 'tableau' ? '已支付' : `${playCost(selected.instanceId, selected.source).credits} 资金 / ${selectionCard.cost.energy} 能量`}</dd></div></dl>
                  <div className={`validation ${selectionError ? 'bad' : 'good'}`}>{selectionError ?? '✓ 资源充足，可以建设。'}</div>
                  <button className="primary full" disabled={Boolean(selectionError) || isReadOnly || selected.source === 'tableau'} onClick={() => { if (selected.source !== 'tableau') send({ type: 'play', instanceId: selected.instanceId, source: selected.source }); }}>确认建设</button><button className="text-button" onClick={() => setSelected(null)}>取消选择</button>
                </> : <><h2>先看清，再落子。</h2><BotanicalArt /><p className="muted">选择一张卡牌，在这里查看效果与费用。每次确认都会记录为可回放的操作。</p><div className="detail-tip"><span>01</span><p>资金支付一次<br /><small>中途选择与刷新不会重复扣费</small></p></div><div className="detail-tip"><span>02</span><p>收入自动结算<br /><small>每轮两位玩家行动后执行</small></p></div></>}
              </section>
              <section className="panel journal"><SectionHeading eyebrow="SESSION JOURNAL" title="对局记录" extra={<span className="tiny">{displayed.commands.length} 步</span>} />
                <div className="journal-list">{events.length ? events.map((event, index) => <button className="journal-entry" key={`${event.revision}-${index}`} onClick={() => setReplayRevision(event.revision)}><span className="journal-step">{String(event.revision).padStart(2, '0')}</span><p>{event.message}</p></button>) : <p className="muted">你的第一个行动，会被记录在这里。</p>}</div>
              </section>
            </aside>
          </div>
          <section className={`action-dock ${view.pending ? 'has-choice' : ''}`} aria-label="当前可执行操作">
            {view.pending && !aiTurn ? <><div><span className="eyebrow">RESOLUTION IN PROGRESS</span><strong data-testid="choice-prompt">{view.pending.prompt}</strong><small>已保存当前进度，完成选择后继续结算</small></div><div className="choice-buttons">{view.pending.options.map(option => <button className="primary" disabled={isReadOnly} key={option.id} onClick={() => send({ type: 'choose', choiceId: view.pending!.id, optionId: option.id })}>{option.label}</button>)}</div></> : <><div><span className="eyebrow">{aiTurn ? 'AI IS PLAYING' : 'ONE TURN, ONE DECISION'}</span><strong>{result ? '这次实验已经完成' : replayRevision !== null ? '正在查看历史状态' : aiTurn ? `AI ${actorName} 正在思考…` : '本回合，你想如何推进？'}</strong><small>{result ? '可以导出完整对局，或新建一次实验' : aiTurn ? 'AI 自动完成行动和选择，你无需切换座位' : '经营、研究，或选择一张卡牌进行建设'}</small></div><div className="button-row"><button className="secondary" disabled={isReadOnly || !view.deckCount} onClick={() => send({ type: 'research' })}>▤ 研究 · 抽 2 张</button><button className="primary" disabled={isReadOnly} onClick={() => send({ type: 'work' })}>经营 · +2 ◈ +1 ✧</button></div></>}
          </section>
          <section className="tools-panel panel"><SectionHeading eyebrow="REPRODUCIBLE BY DESIGN" title="实验工具" extra={<span className="tiny">当前分支 {session.branch.id}</span>} />
            <div className="tools-grid"><label>随机种子<input value={seed} onChange={event => setSeed(event.target.value)} inputMode="numeric" /></label><label>起始场景<select value={scenario} onChange={event => setScenario(event.target.value)}><option value="normal">正常设置</option><option value="choice">选择与恢复验证</option><option value="endgame">终局前一回合</option></select></label><button className="secondary" onClick={newGame}>新建实验对局</button><button className="secondary" disabled={!session.state.debug || !session.commands.length || isReadOnly} onClick={() => install(forkSessionAt(demoGame, session, session.state.revision - 1))}>回退一步并创建分支</button></div>
            <div className="replay-tools"><label htmlFor="replay">回放修订</label><input id="replay" type="range" min={0} max={session.state.revision} value={replayRevision ?? session.state.revision} onChange={event => setReplayRevision(Number(event.target.value))} /><span>{replayRevision ?? session.state.revision} / {session.state.revision}</span><button className="text-button" onClick={() => setReplayRevision(null)} disabled={replayRevision === null}>返回当前对局</button></div>
            <div className="debug-tools"><button className="text-button" disabled={!session.state.debug || isReadOnly || Boolean(view.pending)} onClick={() => {
              const fork = forkSessionAt(demoGame, session, session.state.revision);
              const outcome = applyCommand(demoGame, fork, { id: `${fork.branch.id}-adjust-${fork.state.revision}`, actor: viewer, revision: fork.state.revision, command: { type: 'debug.adjust', resource: 'credits', amount: 5 } });
              if (outcome.ok) install(outcome.session); else setError(outcome.error.message);
            }}>调试：新建分支并增加 5 资金</button><span className="tiny">完整存档包含双方手牌、牌序及调试记录，请在可信测试环境共享。</span></div>
          </section>
        </> : <MatchLobby currentMatch={null} onStart={startMatch} />}
        <footer className="page-footer"><span>独立规则引擎 · 原创公开内容 · 本地运行</span><span>引擎 {demoGame.manifest.engineVersion} / 规则 {demoGame.manifest.rulesVersion} / 内容 {demoGame.manifest.contentVersion}</span></footer>
      </main>
    </div>
  </div>;
}
