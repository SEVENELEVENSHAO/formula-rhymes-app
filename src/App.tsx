import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, ChevronRight, Download, Eye, EyeOff, GraduationCap, Leaf, ListFilter, Search, Shuffle, Upload, X } from 'lucide-react';
import { book, categoryById, filterFormulas, romanize, thermalLabels, type Formula, type Herb } from './data';
import { CategoryNavigation, FormulaCard, FormulaSections, FormulaSummary, IngredientTile, Overlay, PropertyReferences, SourceBlocks } from './components';
import { useLibrary, validLibrary } from './use-library';

type View = 'library' | 'favorites' | 'study' | 'about';
const navItems = [{ id: 'library', name: '方歌全书', sub: 'FORMULA LIBRARY', icon: BookOpen }, { id: 'favorites', name: '我的收藏', sub: 'MY COLLECTION', icon: Bookmark }, { id: 'study', name: '背诵练习', sub: 'STUDY & RECALL', icon: GraduationCap }] as const;

export default function App() {
  const { library, update, toggle, storageError } = useLibrary();
  const [view, setView] = useState<View>('library');
  const [category, setCategory] = useState(book.formulas[0].categoryId);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Formula | null>(book.formulas[0]);
  const [herb, setHerb] = useState<Herb | null>(null);
  const [notice, setNotice] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [studyScope, setStudyScope] = useState<'all' | 'favorites' | 'unlearned'>('all');
  const [hiddenLines, setHiddenLines] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'study' | 'source'>('study');
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const results = filterFormulas(query, category, view === 'favorites' ? library.favorites : null);
  const studyCards = results.filter(f => f.rhyme.length && (studyScope !== 'favorites' || library.favorites.includes(f.id)) && (studyScope !== 'unlearned' || !library.mastered.includes(f.id)));
  const studyCard = studyCards[cardIndex % (studyCards.length || 1)];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  function navigate(next: View) {
    setView(next); setQuery(''); setCategory(next === 'library' ? book.formulas[0].categoryId : '');
    setSelected(next === 'library' ? book.formulas[0] : null); setCardIndex(0); setRevealed(false); setCatalogOpen(false);
    window.scrollTo(0, 0);
  }
  function chooseCategory(id: string) {
    setCategory(id); setQuery(''); setCardIndex(0); setRevealed(false);
    if (view === 'library' || view === 'about') {
      setView('library');
      const first = book.formulas.find(f => f.categoryId === id);
      if (first) openFormula(first);
      else { setSelected(null); setCatalogOpen(false); }
    } else setCatalogOpen(false);
    window.scrollTo(0, 0);
  }
  function openFormula(f: Formula) {
    setSelected(f); setHiddenLines(false); setDetailTab('study');
    setView('library'); setCategory(f.categoryId); setQuery(''); setCatalogOpen(false); window.scrollTo(0, 0);
    update({ ...library, recent: [f.id, ...library.recent.filter(id => id !== f.id)].slice(0, 12) });
  }
  function nextCard() { setCardIndex(i => i + 1); setRevealed(false); }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = '汤头歌诀-学习记录.json'; a.click(); URL.revokeObjectURL(url); setNotice('学习记录已导出');
  }
  async function importData(file: File | undefined) {
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!validLibrary(value)) throw new Error('invalid');
      const known = new Set(book.formulas.map(f => f.id));
      update({ favorites: [...new Set([...library.favorites, ...value.favorites])].filter(id => known.has(id)), mastered: [...new Set([...library.mastered, ...value.mastered])].filter(id => known.has(id)), recent: [...new Set([...library.recent, ...value.recent])].filter(id => known.has(id)).slice(0, 12), notes: { ...Object.fromEntries(Object.entries(value.notes).filter(([id]) => known.has(id))), ...library.notes } });
      setNotice('备份已合并，现有笔记优先保留');
    } catch { setNotice('导入失败：请选择本 App 导出的学习记录 JSON 文件'); }
    if (uploadRef.current) uploadRef.current.value = '';
  }
  const card = (f: Formula) => <FormulaCard key={f.id} formula={f} onOpen={() => openFormula(f)} favorite={library.favorites.includes(f.id)} mastered={library.mastered.includes(f.id)} onFavorite={() => toggle('favorites', f.id)}/>;

  const formulaContent = selected ? <article className="formula-detail inline-reader" aria-label="方歌白话解" key={selected.id}><div className="detail-heading"><span className="eyebrow">{categoryById.get(selected.categoryId)?.name} / {selected.supplement ? '增辑' : '原编'}</span><div className="detail-title-row"><h1>{selected.name}</h1><button className={`outline-button ${library.favorites.includes(selected.id) ? 'is-saved' : ''}`} onClick={() => toggle('favorites', selected.id)} aria-pressed={library.favorites.includes(selected.id)}><Bookmark size={17} fill={library.favorites.includes(selected.id) ? 'currentColor' : 'none'}/>{library.favorites.includes(selected.id) ? '已收藏' : '收藏'}</button></div><p>{romanize(selected.name)}</p><small>{selected.title.slice(selected.name.length)} {selected.preface.join(' ')}</small></div><div className="detail-tabs" role="group" aria-label="阅读方式"><button className={detailTab === 'study' ? 'active' : ''} aria-pressed={detailTab === 'study'} onClick={() => setDetailTab('study')}>方歌研习</button><button className={detailTab === 'source' ? 'active' : ''} aria-pressed={detailTab === 'source'} onClick={() => setDetailTab('source')}>原书全文</button><button className={`mastery-toggle ${library.mastered.includes(selected.id) ? 'active' : ''}`} disabled={!selected.rhyme.length} onClick={() => toggle('mastered', selected.id)} aria-pressed={library.mastered.includes(selected.id)}><Check size={15}/>{library.mastered.includes(selected.id) ? '已熟记' : '标记熟记'}</button></div>
      {detailTab === 'source' ? <div className="original-text"><p className="source-status">书源：{selected.source.file} #{selected.source.anchor} · 自动提取，待校对</p>{selected.preface.map((p, i) => <p key={i}>{p}</p>)}{selected.sections.map(s => <section className="detail-section" key={s.anchor}><h3>{s.title}</h3><SourceBlocks blocks={s.blocks}/></section>)}</div> : <>
        {selected.rhyme.length > 0 && <section className="rhyme-section"><div className="section-heading"><h3>汤头歌诀</h3><button className="text-button" onClick={() => setHiddenLines(!hiddenLines)}>{hiddenLines ? <Eye size={16}/> : <EyeOff size={16}/>}{hiddenLines ? '显示全篇' : '逐句背诵'}</button></div><div className="rhyme-lines">{selected.rhyme.map((line, i) => <RhymeLine key={`${selected.id}-${i}-${hiddenLines}`} line={line} hidden={hiddenLines}/>)}</div></section>}
        <section className="composition-section"><div className="section-heading"><h3>方剂组成</h3><span>{selected.ingredients.length ? `${selected.ingredients.length} 味药` : '原书组成'}</span></div>{selected.ingredients.length ? <><div className="thermal-legend">{(['hot', 'warm', 'neutral', 'cool', 'cold'] as const).map(t => <span key={t}><i className={`thermal-${t}`}/>{thermalLabels[t]}</span>)}<span>灰底：药性待补或待核对</span></div><div className="ingredient-grid">{selected.ingredients.map((ingredient, i) => <IngredientTile key={i} ingredient={ingredient} onHerb={setHerb}/>)}</div><PropertyReferences ingredients={selected.ingredients}/></> : null}{selected.compositionNote && <p className="source-status">{selected.compositionNote}。</p>}<details className="composition-original" open={!selected.ingredients.length}><summary>组成原文 · 保留原书剂量</summary><SourceBlocks blocks={selected.sections.find(s => s.title === '组成')?.blocks || []}/></details><p className="source-status">组成与剂量据原书，古制单位未换算。药性依据 Open Herbology 的同名、异体字和别名记录；炮制或部位差异另标“基药参考”，缺失或含糊者保留待核对。</p></section>
        <FormulaSections formula={selected}/>
      </>}
      <section className="detail-section notes-section"><h3>我的笔记</h3><label className="sr-only" htmlFor="personal-note">这首方歌的学习笔记</label><textarea id="personal-note" value={library.notes[selected.id] || ''} placeholder="记下易混的药味、歌诀或自己的理解…" onChange={e => update({ ...library, notes: { ...library.notes, [selected.id]: e.target.value } })}/><small>{storageError ? '尚未保存，请导出备份' : '自动保存在此浏览器，可在侧栏导出备份'}</small></section><div className="detail-source"><BookOpen size={18}/><p>《汤头歌诀白话解》第6版<br/><small>{selected.source.file} · {selected.source.anchor} · 待校对</small></p></div><div className="detail-pagination"><button className="outline-button" disabled={book.formulas.indexOf(selected) === 0} onClick={() => openFormula(book.formulas[book.formulas.indexOf(selected) - 1])}><ArrowLeft size={17}/>上一篇</button><button className="outline-button" disabled={book.formulas.indexOf(selected) === book.formulas.length - 1} onClick={() => openFormula(book.formulas[book.formulas.indexOf(selected) + 1])}>下一篇<ArrowRight size={17}/></button></div></article> : null;
  const categoryNavigation = <CategoryNavigation category={category} selectedId={selected?.id} showFormulas={view === 'library' && !query} onCategory={chooseCategory} onFormula={openFormula}/>;

  return <div className="app-shell">
    <a className="skip-link" href="#main">跳到内容</a>
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('library')} aria-label="汤头歌诀首页"><span className="brand-mark">汤</span><span><strong>汤头歌诀</strong><small>FORMULA RHYMES</small></span></button>
      <nav className="main-nav" aria-label="主导航">{navItems.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)} aria-current={view === n.id ? 'page' : undefined}><n.icon size={21}/><span>{n.name}<small>{n.sub}</small></span>{n.id === 'favorites' && <b>{library.favorites.length}</b>}</button>)}</nav>
      <section className="sidebar-categories"><div className="sidebar-category-heading"><span>全书目录</span><small>23 门类</small></div>{categoryNavigation}</section>
      <div className="sidebar-progress"><div><span>研习进度</span><strong>{library.mastered.length}<small> / {book.formulas.filter(f => f.rhyme.length).length}</small></strong></div><progress value={library.mastered.length} max={book.report.withRhyme}/><p>一方一歌，循序而习。</p></div>
      <div className="sidebar-bottom"><button onClick={() => navigate('about')} className={view === 'about' ? 'active' : ''}><Leaf size={18}/><span>关于本书与学习资料</span></button><div className="backup-actions"><button onClick={exportData}><Download size={15}/>导出记录</button><button onClick={() => uploadRef.current?.click()}><Upload size={15}/>导入</button><input ref={uploadRef} type="file" accept=".json,application/json" aria-label="导入学习记录" hidden onChange={e => void importData(e.target.files?.[0])}/></div><small>《汤头歌诀白话解》第6版<br/>本地学习 · Open Herbology 设计</small></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="catalog-toggle icon-button" aria-label="打开分类目录" onClick={() => setCatalogOpen(true)}><ListFilter size={21}/></button><div className="topbar-label">方歌研习<span> / </span>{view === 'library' ? '全书' : view === 'study' ? '练习' : view === 'about' ? '书源' : '收藏'}</div><label className="global-search"><Search size={18}/><span className="sr-only">搜索方名、歌诀、药材或主治</span><input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setCategory(e.target.value ? '' : selected?.categoryId || ''); setCardIndex(0); setRevealed(false); if (view === 'about') setView('library'); }} placeholder="搜索方名、歌诀、药材、主治…"/>{query ? <button aria-label="清空搜索" onClick={() => setQuery('')}><X size={17}/></button> : <kbd>Ctrl K</kbd>}</label><span className="edition-tag">第六版</span></header>
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
      <main id="main" className="content">
        {view === 'about' ? <About/> : view === 'library' && selected && !query ? formulaContent : <>
          <div className="page-heading"><div className="eyebrow">{view === 'study' ? 'STUDY & RECALL' : view === 'favorites' ? 'YOUR PERSONAL COLLECTION' : 'THE ART OF FORMULA RHYMES'}</div><div className="heading-row"><div><h1>{view === 'study' ? '读懂一方，记住一歌。' : view === 'favorites' ? '我的收藏' : category ? categoryById.get(category)?.name : query ? '查找方歌' : '汤头有歌，方药有章。'}</h1><p>{view === 'study' ? '先试着回忆，再展开歌诀。让方名、组成与方义相互印证。' : view === 'favorites' ? '把想再读的方歌留在这里，慢慢积累自己的方剂手册。' : '循歌诀识方，以白话明理。从一首方歌，读懂一方配伍。'}</p></div>{view === 'library' && <button className="outline-button heading-action" onClick={() => navigate('study')}><GraduationCap size={18}/>开始背诵<ArrowUpRight size={16}/></button>}</div></div>
            <div className="filter-toolbar">{view === 'study' && <select aria-label="练习范围" value={studyScope} onChange={e => { setStudyScope(e.target.value as typeof studyScope); setCardIndex(0); setRevealed(false); }}><option value="all">全部方歌</option><option value="favorites">只练收藏</option><option value="unlearned">尚未熟记</option></select>}<span>{view === 'study' ? studyCards.length : results.length} 个条目</span>{(category || query) && <button className="text-button" onClick={() => { setCategory(''); setQuery(''); }}>清除筛选<X size={14}/></button>}</div>
            {view === 'study' ? studyCard ? <section className="study-panel"><div className="study-progress"><span>方歌回忆</span><span>{cardIndex % studyCards.length + 1} / {studyCards.length}</span></div><div className="study-prompt"><small>{categoryById.get(studyCard.categoryId)?.name}</small><h2>{studyCard.name}</h2><p>{romanize(studyCard.name)}</p><span>你还记得这首方歌吗？</span></div>{revealed ? <><div className="study-rhyme">{studyCard.rhyme.map((line, i) => <p key={i}>{line}</p>)}</div><div className="study-ingredients">{studyCard.ingredients.map((i, n) => <span key={n} className={`thermal-${i.thermal}`}>{i.name}</span>)}</div><FormulaSummary formula={studyCard}/><button className="text-button" onClick={() => openFormula(studyCard)}>阅读白话解<ArrowUpRight size={16}/></button></> : <div className="recall-placeholder"><BookOpen size={32}/><p>在心中默诵，或拿起纸笔写下。</p></div>}<div className="study-actions"><button className="outline-button" onClick={() => { setCardIndex(i => i + 1 + Math.floor(Math.random() * Math.max(studyCards.length - 1, 1))); setRevealed(false); }}><Shuffle size={17}/>随机一首</button>{!revealed ? <button className="primary-button" onClick={() => setRevealed(true)}><Eye size={18}/>展开歌诀</button> : <button className="primary-button" onClick={() => { if (!library.mastered.includes(studyCard.id)) toggle('mastered', studyCard.id); nextCard(); }}><Check size={18}/>已记住，下一首</button>}<button className="outline-button" onClick={nextCard}>再练下一首<ArrowRight size={17}/></button></div></section> : <Empty text="当前范围内没有可练习的方歌" action="练习全部方歌" onClick={() => { setStudyScope('all'); setQuery(''); setCategory(''); }}/>
              : results.length ? <>{category && categoryById.get(category)?.intro.length ? <details className="category-intro"><summary>本类提要 · 原书说明</summary><SourceBlocks blocks={categoryById.get(category)!.intro}/></details> : null}<div className="formula-grid">{results.map(card)}</div></> : <Empty text={view === 'favorites' && !library.favorites.length ? '还没有收藏的方歌' : '没有找到匹配的方歌'} action={view === 'favorites' ? '去方歌全书看看' : '清除筛选'} onClick={() => navigate('library')}/>
            }
        </>}
        <footer className="page-footer"><Leaf size={15}/><span>据《汤头歌诀白话解》第6版整理 · 仅供学习参考</span><button onClick={() => navigate('about')}>查看书源<ArrowUpRight size={13}/></button></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="移动端主导航">{navItems.map(n => <button key={n.id} aria-current={view === n.id ? 'page' : undefined} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><n.icon size={21}/>{n.name}</button>)}<button className={view === 'about' ? 'active' : ''} onClick={() => navigate('about')}><Leaf size={21}/>书源与备份</button></nav>

    {catalogOpen && <Overlay title="分类目录" compact onClose={() => setCatalogOpen(false)}><div className="mobile-catalog">{categoryNavigation}</div></Overlay>}
    {herb && <Overlay compact title="药材资料" onClose={() => setHerb(null)}><div className="herb-detail"><div className={`herb-banner thermal-${herb.thermal}`}><small>{herb.context?.match.scope === 'base-herb' ? '基药参考资料' : herb.natureLabel}</small><h2>{herb.context?.originalName || herb.name}</h2><p>{romanize(herb.context?.originalName || herb.name)}</p></div><section className="detail-section"><h3>{herb.context?.match.scope === 'base-herb' ? '基药性味归经' : '性味归经'}</h3>{herb.context && <p className="reference-context">参考条目：{herb.name}<br/>{herb.context.match.note}</p>}<p>{herb.nature || '未收录'}</p></section><section className="detail-section"><h3>{herb.context?.match.scope === 'base-herb' ? '基药功用 · 资料摘录' : '功用 · 资料摘录'}</h3><p>{herb.action || '未收录'}</p></section><section className="detail-section"><h3>本书含此药的方剂</h3><p className="muted">列出已关联此参考药材的条目；原书药名及炮制名保持不变。</p><div className="related-formulas">{book.formulas.filter(f => f.ingredients.some(i => i.herbId === herb.id)).map(f => <button key={f.id} onClick={() => { setHerb(null); openFormula(f); }}>{f.name}<ChevronRight size={16}/></button>)}</div></section><p className="source-status">资料来源：{herb.source} · 待校对。方剂组成仍以本书原文为准。</p></div></Overlay>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;

  function About() {
    return <div className="about-page"><div className="eyebrow">SOURCE & READING NOTES</div><h1>以原书为本。</h1><p className="about-lead">《汤头歌诀白话解》第6版<br/>把方歌、药味与方义放在一起读。</p><section className="detail-section"><h2>这份方歌手册</h2><p>本 App 从你提供的 EPUB 完整解说部分提取 {book.formulas.length} 个条目，按原书 20 类方剂及便用杂方、幼科、经络歌诀 3 个附篇编排；歌诀汇编中的重复条目不重复计入。</p><p>{book.report.withRhyme} 个条目包含可练习的歌诀；{book.report.structuredCompositions} 个条目已自动拆分成分卡。复杂炮制、分段剂量及其他尚未拆分的组成保留原文，未补写缺失信息。附方保留在所属条目内。</p></section><section className="detail-section"><h2>阅读与学习</h2><p>可按方名、拼音及首字母、歌诀、组成和主治搜索；可收藏、逐句背诵、标记熟记并添加笔记。收藏与笔记保存在当前浏览器，建议定期导出备份。</p><div className="about-backup"><button className="outline-button" onClick={exportData}><Download size={17}/>导出学习记录</button><button className="outline-button" onClick={() => uploadRef.current?.click()}><Upload size={17}/>导入备份</button></div></section><section className="detail-section"><h2>出处与校对状态</h2><p>书籍：{book.source.filename}</p><p>每个条目保留 EPUB 文件名和锚点；“原书全文”保留正文、上下注标记及原书字形图片。自动提取内容尚未经人工逐条校对。药材性味和色彩通过 Open Herbology 的同名、异体字、别名及炮制规格关联。原书药名保持不变；炮制或药用部位差异另标“基药参考”。芍药未分赤白等含糊名称继续待核对。</p><p>原书用法、主治、古制剂量等属于学习资料，不是个人用药建议。电子书再分发授权未独立核实；内容仅供学习参考。</p><details><summary>文件校验信息</summary><code className="hash">SHA-256: {book.source.sha256}</code></details></section><section className="detail-section"><h2>药性资料覆盖</h2><p>在已拆分的 {book.report.herbMatching.ingredientOccurrences} 次药味记录中，{book.report.herbMatching.linkedOccurrences} 次已关联参考药材，{book.report.herbMatching.withThermal} 次有药性分组（包括明确标注的基药参考）。自动关联不等于药性已逐条人工审核。</p><details><summary>查看仍需补充或核对的药名</summary><div className="pending-herbs">{Object.entries(book.report.herbMatching.pending).map(([name, count]) => <span key={name}>{name}<small>{count}</small></span>)}</div></details></section><section className="detail-section"><h2>设计参考</h2><p>沿用 Open Herbology 当前的黑色画布、彩色分类块与成分卡交互：药名竖排、寒热配色、剂量独立展示，点击已匹配药材可查看资料及关联方剂。</p></section></div>;
  }
}

function RhymeLine({ line, hidden }: { line: string; hidden: boolean }) {
  const [shown, setShown] = useState(!hidden);
  return hidden ? <button className={`rhyme-line ${shown ? '' : 'concealed'}`} aria-label={shown ? `隐藏：${line}` : '点击显示这一句歌诀'} onClick={() => setShown(!shown)}>{shown ? line : '点击回忆这一句'}{!shown && <Eye size={16}/>}</button> : <p className="rhyme-line">{line}</p>;
}
function Empty({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><BookOpen size={36}/><h2>{text}</h2><p>可换一个关键词，或从原书分类开始浏览。</p><button className="outline-button" onClick={onClick}>{action}<ArrowRight size={16}/></button></div>;
}
