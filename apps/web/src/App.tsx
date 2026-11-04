import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { arkReferenceSchema, referenceCardName, type ArkReference } from '@eurogame/content';
import { LeafMark, SectionHeading } from '@eurogame/ui-kit';
import { LayoutLab } from './LayoutLab.js';
import { MatchLobby } from './MatchLobby.js';
import { MatchLibrary } from './matches/MatchLibrary.js';
import { useMatchLibrary } from './matches/useMatchLibrary.js';
import { GAMES, gameById, restoreGame } from './catalog/games.js';
import type { MatchSettings } from './catalog/types.js';
import { lastMatch, readMatch } from './storage.js';
import './matches/library.css';
const AssetLibrary = lazy(async () => ({ default: (await import('./ark/AssetLibrary.js')).AssetLibrary }));
declare const __BUILD_SHA__: string;
const navigation = [
  { id: 'lobby', symbol: '⌂', label: '创建对局', caption: 'GAME LOBBY' },
  { id: 'matches', symbol: '▣', label: '我的对局', caption: 'MY MATCHES' },
  { id: 'table', symbol: '◈', label: '对局工作台', caption: 'PLAY & EXPLORE' },
  { id: 'ark', symbol: '⬟', label: '方舟牌桌', caption: 'ARK NOVA' },
  { id: 'rules', symbol: '◇', label: '游戏规则', caption: 'HOW TO PLAY' },
  { id: 'layout', symbol: '⬡', label: '建造交互实验', caption: 'SPATIAL LAB' },
  { id: 'coverage', symbol: '◎', label: '方舟规则进度', caption: 'RULE COVERAGE' },
  { id: 'catalog', symbol: '▤', label: '本地参考卡库', caption: 'LOCAL REFERENCE' },
  { id: 'assets', symbol: '▧', label: '美术资源', caption: 'ASSET LIBRARY' }
];
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function App() {
  const [route, setRoute] = useState(window.location.hash.slice(2) || 'lobby');
  const library = useMatchLibrary();
  const [starting, setStarting] = useState(false);
  const [Rules, setRules] = useState<ComponentType<{ hasMatch: boolean }> | null>(null);
  const [arkCoverage, setCoverage] = useState<typeof import('@eurogame/game-ark-nova').arkCoverage | null>(null);
  const [reference, setReference] = useState<ArkReference | null>(null);
  const [search, setSearch] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const referenceUpload = useRef<HTMLInputElement>(null);
  const opened = library.opened;
  const game = opened ? gameById(opened.info.gameId) : null;
  const tableRoute = route.startsWith('matches/') || route === 'ark' || route === 'table';
  const active = tableRoute && Boolean(opened) && !library.busy && (route.startsWith('matches/') ? route.slice(8) === opened?.info.id : route === game?.tableRoute);
  useEffect(() => {
    const changed = () => setRoute(window.location.hash.slice(2) || 'lobby');
    window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    if (library.loading) return;
    if (route.startsWith('matches/')) { void library.open(route.slice(8)); return; }
    if (route === 'table' || route === 'ark') {
      const id = route === 'ark' ? 'ark-nova' : 'garden-lab';
      if (opened?.info.gameId === id) return;
      let alive = true;
      void lastMatch(id).then(matchId => { if (alive && matchId) void library.open(matchId); }).catch(error => library.setError(String(error)));
      return () => { alive = false; };
    }
  }, [route, library.loading, library.open, opened?.info.gameId]);
  useEffect(() => {
    if (route !== 'rules' && route !== 'ark-rules') return;
    let alive = true; setRules(null);
    void gameById(route === 'ark-rules' ? 'ark-nova' : 'garden-lab').load().then(adapter => { if (alive) setRules(() => adapter.Rules); }).catch(error => { if (alive) library.setError(`规则加载失败：${String(error)}`); });
    return () => { alive = false; };
  }, [route]);
  useEffect(() => { if (route === 'coverage' && !arkCoverage) void import('@eurogame/game-ark-nova').then(module => setCoverage(module.arkCoverage)).catch(error => library.setError(`覆盖资料加载失败：${String(error)}`)); }, [route, arkCoverage]);
  async function startMatch(settings: MatchSettings) {
    if (starting) return;
    setStarting(true);
    try {
      const descriptor = gameById(settings.game);
      if (!descriptor.playerCounts.includes(settings.playerCount) || settings.mode !== 'ai') throw new Error('此游戏不支持当前人数或模式。');
      const runtime = (await descriptor.load()).create(settings);
      const id = await library.create(runtime);
      if (id) window.location.hash = `/matches/${id}`;
    } catch (error) { library.setError(error instanceof Error ? error.message : '创建失败。'); }
    finally { setStarting(false); }
  }
  async function importSave(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('存档超过 5 MB 上限。');
      const runtime = await restoreGame(await file.text());
      const id = await library.create(runtime, `${gameById(runtime.gameId).name} · 导入对局`);
      if (id) window.location.hash = `/matches/${id}`;
    } catch (error) { library.setError(`导入失败：${error instanceof Error ? error.message : '文件无效'} 当前对局保持不变。`); }
  }
  async function exportMatch(id: string) {
    try { const record = await readMatch(id); download(record.archive, `${record.info.gameId}-${id}.json`); }
    catch (error) { library.setError(error instanceof Error ? error.message : '导出失败。'); }
  }
  async function importReference(file: File | undefined) {
    if (!file) return;
    try { if (file.size > 10_000_000) throw new Error('参考资料超过 10 MB 上限。'); setReference(arkReferenceSchema.parse(JSON.parse(await file.text()))); }
    catch (error) { library.setError(`资料包无效：${error instanceof Error ? error.message : '未知错误'}`); }
  }
  if (library.loading) return <main className="loading"><LeafMark /><p>正在准备对局库…</p></main>;
  const latest = library.matches.filter(match => !match.archived).slice(0, 2);
  const lobby = <MatchLobby matches={latest} onStart={startMatch} busy={starting || library.busy} />;
  return <div className={`app-shell ${active && game?.id === 'ark-nova' ? 'ark-focus' : ''}`}>
    <aside className="sidebar"><a className="brand" href="#/lobby"><span className="brand-mark"><LeafMark /></span><span>EUROGAME<small>ENGINE LAB</small></span></a><div className="workspace-label">你的桌游实验室 <span>LOCAL</span></div>
      <nav aria-label="工作台导航">{navigation.map(item => <a key={item.id} href={`#/${item.id}`} aria-label={item.label} title={item.label} className={route === item.id ? 'active' : ''}><span className="nav-symbol">{item.symbol}</span><span>{item.label}<small>{item.caption}</small></span></a>)}</nav>
      <div className="sidebar-footer"><span className="status-dot" />本地工作台 · v0.1.0<small>构建 {__BUILD_SHA__}</small></div>
    </aside>
    <div className="workspace"><header className="topbar"><div><span className="breadcrumb">实验室 / {active ? opened!.info.title : navigation.find(item => item.id === route)?.label ?? '创建对局'}</span><span className="pill subtle">首期实验版</span></div>
      <div className="topbar-actions"><a className="secondary small" href="#/lobby">＋ 创建对局</a><a className="text-button" href={`#/${game?.rulesRoute ?? 'rules'}`}>游戏规则</a><span className="save-status" role="status"><span className="status-dot" />{library.status}</span>
        <button className="secondary small" onClick={() => upload.current?.click()}>↥ 导入存档</button><button className="secondary small" disabled={!opened} onClick={() => { if (opened) download(opened.runtime.archive, `${opened.info.gameId}-${opened.info.id}.json`); }}>↧ 导出对局</button></div>
      <input ref={upload} type="file" accept=".json,application/json" className="visually-hidden" aria-label="导入对局文件" onChange={event => { void importSave(event.target.files?.[0]); event.target.value = ''; }} />
    </header><main className="workspace-main">
      {library.error && <div className="error-banner" role="alert"><span>{library.error}</span><button aria-label="关闭提示" onClick={() => library.setError('')}>×</button></div>}
      {library.busy && <p className="match-loading" role="status">正在校验并恢复对局…</p>}
      {active && opened?.readOnly && <div className="match-readonly" role="status">此对局正在另一页面操作，本页只读。<button className="text-button" onClick={() => { void library.open(opened.info.id, true); }}>重新载入并尝试接管</button></div>}
      <div hidden={!active} className="active-game-panel" key={opened?.info.id}>{opened?.runtime.render({ active, readOnly: opened.readOnly, onChange: next => library.change(next, opened.runtime), onFork: next => { void library.create(next, `${opened.info.title} · 实验副本`).then(id => { if (id) window.location.hash = `/matches/${id}`; }); } })}</div>
      {active ? null : route === 'matches' ? <MatchLibrary matches={library.matches} edit={library.edit} exportMatch={id => { void exportMatch(id); }} />
        : route === 'assets' ? <Suspense fallback={<p>正在读取资源目录…</p>}><AssetLibrary /></Suspense>
        : route === 'rules' || route === 'ark-rules' ? Rules ? <Rules hasMatch={Boolean(opened && game?.rulesRoute === route)} /> : <p>正在加载规则…</p>
        : route === 'lobby' || tableRoute ? lobby
        : route === 'coverage' && !arkCoverage ? <p>正在加载规则覆盖…</p>
: route === 'layout' ? <LayoutLab /> : route === 'coverage' ? <>
          <div className="page-intro"><span className="eyebrow">ARK NOVA / IMPLEMENTATION TRACKER</span><h1>让每一条规则，<br />都有据可查。</h1><p>资料覆盖、程序实现与人工复核分别记录。基础 235 张内容均已接入；完整基础版人工试玩与逐卡复核尚未验收。</p></div>
          <div className="coverage-counters">{arkCoverage!.targets.map(target => <div className="panel coverage-counter" key={target.category}><span>{target.label}</span><strong>{arkCoverage!.cards.filter(card => card.category === target.category && card.implemented).length}<small> / {target.expected}</small></strong><span className="tiny">规则实现数量</span></div>)}</div>
          <div className="panel coverage-panel"><SectionHeading eyebrow="RULE TRACEABILITY" title="双人基础版规则矩阵" extra={<span className="pill">地图 A / 0 / 1 / 2 · 阶段四</span>} />
            <table><thead><tr><th>规则</th><th>依据</th><th>实现进度</th></tr></thead><tbody>{arkCoverage!.rules.map(rule => <tr key={rule.id}><td><strong>{rule.label}</strong><small>{rule.id}</small></td><td>{rule.source}</td><td><span className={`pill ${rule.status === 'tested' ? 'green' : 'subtle'}`}>{rule.status === 'tested' ? '已测试 · 待人工核对' : '尚未实现'}</span></td></tr>)}</tbody></table>
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
        </>  : lobby}
      <footer className="page-footer"><span>独立规则引擎 · 本地对局库 · 不跨设备同步</span><span>构建 {__BUILD_SHA__} · {GAMES.length} 款游戏</span></footer>
    </main></div>
  </div>;
}
