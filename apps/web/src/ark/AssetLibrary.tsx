import { useState } from 'react';
import { SPRITES, ATLASES } from '../../asset-definitions.js';
import { useArkAssets, loadArkAssets } from './asset-store.js';
import { ArkIcon } from './ArkIcon.js';
import './asset-library.css';

export function AssetLibrary() {
  const state = useArkAssets();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [limit, setLimit] = useState(60);
  const files = state.catalog.files.filter(file => (kind === 'all' || file.kind === kind) && `${file.id} ${file.label} ${file.file}`.toLowerCase().includes(query.toLowerCase()));
  const failed = Object.values(state.status).filter(status => status === 'failed').length;
  function exportCatalog() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...state.catalog, loadStatus: state.status }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `ark-assets-${state.catalog.revision}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <article className="asset-library">
    <header className="asset-library-heading"><div><span className="eyebrow">ART LIBRARY / SOURCE & QUALITY</span><h1>方舟美术资源</h1><p>按语义管理卡图、图标、地形、建筑与地标。原图保留在本地参考目录，公开版本使用内置图形。</p></div><a className="secondary" href="#/ark">返回牌桌</a></header>
    <section className="asset-counters">
      <div className="panel"><strong>{state.catalog.files.length}</strong><span>已登记文件</span></div>
      <div className="panel"><strong>{Object.keys(SPRITES).length}</strong><span>统一图集区域</span></div>
      <div className="panel"><strong>{(state.catalog.files.reduce((total, file) => total + file.bytes, 0) / 1048576).toFixed(1)} MB</strong><span>本地原图总量</span></div>
      <div className="panel"><strong>{state.catalog.issues.length + failed}</strong><span>目录／加载问题</span></div>
    </section>
    <section className="panel asset-source"><div><strong>{state.loading ? '正在登记本地素材…' : state.catalog.referenceAvailable ? '本地参考素材已连接' : '内置矢量图已准备'}</strong><p>{state.catalog.source.notice}</p><small>版本 {state.catalog.revision} · 图片版本 URL 按内容哈希生成 · 图集共享预加载</small></div><button className="secondary" disabled={state.loading} onClick={() => { void loadArkAssets(true); }}>刷新资源目录</button><button className="primary" onClick={exportCatalog}>导出资源诊断</button></section>
    <section className="panel asset-builtin"><div><strong>内置图标规范</strong><p>形状和颜色表达相同语义；本地素材缺失时自动回退，避免空白区域。</p></div><div>{['money', 'appeal', 'conservation', 'reputation', 'worker', 'science', 'predator', 'bird', 'water', 'rock', 'kiosk', 'pavilion'].map(name => <ArkIcon key={name} name={name} />)}</div></section>
    {!!state.catalog.issues.length && <details className="panel asset-issues"><summary>查看 {state.catalog.issues.length} 项目录问题</summary>{state.catalog.issues.map(issue => <p key={issue}>{issue}</p>)}</details>}
    <div className="asset-filters"><label>查找资源<input aria-label="查找美术资源" type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(60); }} placeholder="编号、名称或文件，例如 203" /></label><label>资源类别<select value={kind} onChange={event => { setKind(event.target.value); setLimit(60); }}><option value="all">全部</option><option value="animal">动物</option><option value="sponsor">赞助商</option><option value="atlas">图集</option></select></label><span>{files.length} 项结果</span></div>
    <div className="asset-file-grid">{files.slice(0, limit).map(file => <article className="panel asset-file" key={file.id}>
      <div className="asset-thumbnail"><img src={file.src} alt={file.label} loading="lazy" decoding="async" /></div><div><span className="eyebrow">{file.id}</span><h2>{file.label}</h2><p>{file.width} × {file.height} · {(file.bytes / 1024).toFixed(0)} KB</p><p>{file.variant === 'original' ? '原图' : '替代图'} · 本地参考，公开构建排除</p><code title={file.sha256}>{file.sha256.slice(0, 16)}</code></div>
    </article>)}</div>
    {!state.loading && !files.length && <p className="panel asset-empty">{state.catalog.referenceAvailable ? '没有符合条件的资源。' : '参考目录尚未连接。内置图标和示意图仍支持完整操作；在本地准备 references/ 后可刷新目录。'}</p>}
    {files.length > limit && <button className="secondary full" onClick={() => setLimit(value => value + 60)}>继续显示资源</button>}
    <section className="panel asset-atlas-guide"><h2>图集与发布边界</h2>{ATLASES.map(atlas => <p key={atlas.id}><strong>{atlas.label}</strong><span>{atlas.width} × {atlas.height}</span><code>{atlas.file}</code></p>)}<p>审核记录：第三方原图使用条件待确认；内置 SVG/CSS 为项目原创。正式图像文件进入公开构建前，必须登记来源、许可及审核哈希。</p></section>
  </article>;
}
