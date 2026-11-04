import { useEffect, useMemo, useState } from 'react';
import { applyCommand, createSession, forkSessionAt, visibleEvents } from '@eurogame/engine-core';
import { getCard } from '@eurogame/content';
import { demoGame, createChoiceScenario, createEndgameScenario, currentActor, playCost, type DemoSession, type DemoCommand } from '@eurogame/game-demo';
import { chooseDemoCommand } from '@eurogame/game-demo/ai';
import { BotanicalArt, LeafMark, ResourceCounter, SectionHeading } from '@eurogame/ui-kit';
import { CardTile, familyLabels } from '../CardTile.js';
import type { PanelProps } from '../catalog/types.js';

export function DemoPanel({ session, active, readOnly, onChange, onFork }: PanelProps<DemoSession>) {
  const [seed, setSeed] = useState(String(session.seed));
  const [scenario, setScenario] = useState('normal');
  const [selected, setSelected] = useState<{ instanceId: string; source: 'hand' | 'market' | 'tableau' } | null>(null);
  const [replayRevision, setReplayRevision] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [error, setError] = useState('');
  const [aiFailure, setAiFailure] = useState<string | null>(null);
  const viewer = 'p1';
  const displayed = useMemo(() => replayRevision === null ? session : forkSessionAt(demoGame, session, replayRevision), [session, replayRevision]);
  const view = demoGame.getPlayerView(displayed.state, viewer);
  const player = view.players.find(candidate => candidate.id === viewer)!;
  const actor = currentActor(displayed.state);
  const actorName = view.players.find(candidate => candidate.id === actor)?.name ?? '';
  const result = demoGame.getResult(displayed.state);
  const aiTurn = displayed.state.phase !== 'finished' && actor !== viewer;
  const isReadOnly = readOnly || !active || replayRevision !== null || aiTurn || Boolean(result);
  const selectionCard = selected ? getCard(selected.instanceId) : null;
  const selectionError = selected ? selected.source === 'tableau' ? '这张卡牌已经建设。' : demoGame.validateCommand(displayed.state, viewer, { type: 'play', instanceId: selected.instanceId, source: selected.source })?.message ?? null : null;
  const events = visibleEvents(displayed.events, viewer).slice(-50).reverse();
  useEffect(() => {
    if (!active || readOnly || replayRevision !== null || session.state.phase === 'finished' || currentActor(session.state) === viewer || aiFailure) return;
    const timer = setTimeout(() => {
      const actor = currentActor(session.state);
      try {
        const decision = demoGame.getDecision(session.state, actor);
        if (!decision) throw new Error('AI 没有合法决策。');
        const outcome = applyCommand(demoGame, session, { id: `ai-${session.branch.id}-${session.state.revision}`, actor, revision: session.state.revision, command: chooseDemoCommand(demoGame.getPlayerView(session.state, actor), decision) });
        if (!outcome.ok) throw new Error(outcome.error.message);
        onChange(outcome.session);
      } catch (error) { setAiFailure(error instanceof Error ? error.message : 'AI 失败'); }
    }, 650);
    return () => clearTimeout(timer);
  }, [session, active, readOnly, replayRevision, aiFailure, onChange]);
  function install(next: DemoSession) { if (isReadOnly) return; onFork(next); }
  function send(command: DemoCommand) {
    if (isReadOnly) return;
    const outcome = applyCommand(demoGame, session, { id: `${session.branch.id}-${session.state.revision}`, actor: viewer, revision: session.state.revision, command });
    if (!outcome.ok) { setError(outcome.error.message); return; }
    onChange(outcome.session); setSelected(null); setError('');
  }
  function newGame() {
    const numericSeed = Number(seed);
    if (!/^\d+$/.test(seed) || !Number.isInteger(numericSeed) || numericSeed < 0 || numericSeed > 0xffff_ffff) { setError('种子应为 0–4294967295 的整数。'); return; }
    onFork(scenario === 'choice' ? createChoiceScenario(numericSeed) : scenario === 'endgame' ? createEndgameScenario(numericSeed) : createSession(demoGame, { debug: true }, numericSeed));
  }
  return <>{error && <div role="alert" className="error-banner">{error}</div>}{aiFailure && <div role="alert" className="error-banner">AI 暂停：{aiFailure}<button onClick={() => setAiFailure(null)}>重试 AI</button></div>}
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
  </>;
}
