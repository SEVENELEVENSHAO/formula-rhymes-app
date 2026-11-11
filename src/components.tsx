import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Bookmark, Check, ChevronRight, X } from 'lucide-react';
import { book, categoryById, herbById, romanize, sectionText, thermalLabels, type Formula, type Herb, type Ingredient, type Block } from './data';

export function CategoryNavigation({ category, selectedId, showFormulas, onCategory, onFormula }: {
  category: string; selectedId?: string; showFormulas: boolean;
  onCategory: (id: string) => void; onFormula: (formula: Formula) => void;
}) {
  const treeId = useId();
  const treeRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(() => {
    const tree = treeRef.current;
    const heading = tree?.querySelector<HTMLElement>('.category-tree-button.active');
    if (tree && heading) tree.scrollTop += heading.getBoundingClientRect().top - tree.getBoundingClientRect().top;
  }, [category, showFormulas, collapsed]);
  useLayoutEffect(() => {
    const tree = treeRef.current;
    const active = tree?.querySelector<HTMLElement>('.category-formulas button.active');
    if (!tree || !active) return;
    const bounds = tree.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.bottom > bounds.bottom) tree.scrollTop += item.bottom - bounds.bottom + 12;
    else if (item.top < bounds.top) tree.scrollTop += item.top - bounds.top - 12;
  }, [selectedId, showFormulas, collapsed]);
  return <nav ref={treeRef} className="category-tree" aria-label="方剂分类">
    <button className={`category-all ${!category ? 'active' : ''}`} onClick={() => onCategory('')} aria-current={!category ? 'true' : undefined}><BookOpenIcon/><span>全部方歌</span><small>{book.formulas.length}</small></button>
    {book.categories.map((c, index) => {
      const formulas = book.formulas.filter(f => f.categoryId === c.id);
      const expanded = showFormulas && category === c.id && !collapsed;
      return <div className="category-tree-group" key={c.id}>
        <button className={`category-tree-button category-tone-${index % 5} ${category === c.id ? 'active' : ''}`} onClick={() => { if (category === c.id && showFormulas) setCollapsed(value => !value); else { setCollapsed(false); onCategory(c.id); } }} aria-expanded={expanded} aria-controls={expanded ? `${treeId}-${c.id}` : undefined}><i/><span>{c.name.replace('附：', '')}</span><small>{formulas.length}</small><ChevronRight size={14}/></button>
        {expanded && <div id={`${treeId}-${c.id}`} className="category-formulas">{formulas.map(f => <button key={f.id} aria-current={selectedId === f.id ? 'page' : undefined} className={selectedId === f.id ? 'active' : ''} onClick={() => onFormula(f)}>{f.name}{f.supplement && <small>增</small>}</button>)}</div>}
      </div>;
    })}
  </nav>;
}
function BookOpenIcon() { return <span className="category-all-mark" aria-hidden="true">全</span>; }

export function SourceBlocks({ blocks }: { blocks: Block[] }) {
  return <div className="source-prose">{blocks.map((b, i) => <p key={i} dangerouslySetInnerHTML={{ __html: b.html.replaceAll('src="/book-images/', `src="${import.meta.env.BASE_URL}book-images/`) }} />)}</div>;
}
export function Overlay({ title, onClose, children, compact = false }: { title: string; onClose: () => void; children: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = old; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`drawer ${compact ? 'compact' : ''}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <div className="drawer-bar"><span>{title}</span><button className="icon-button" aria-label={`关闭${title}`} onClick={onClose}><X size={20}/></button></div>{children}
  </dialog>;
}
export function IngredientTile({ ingredient, onHerb }: { ingredient: Ingredient; onHerb: (h: Herb) => void }) {
  const herb = ingredient.herbId ? herbById.get(ingredient.herbId) : undefined;
  const reference = ingredient.match.scope === 'base-herb';
  const content = <><div className={`ingredient-color thermal-${ingredient.thermal}`}><div className="ingredient-meta"><span>{ingredient.natureLabel || thermalLabels[ingredient.thermal]}</span><small>{romanize(ingredient.name)}</small>{reference && <em>基药参考</em>}{herb && <ArrowUpRight size={15}/>}</div><strong>{ingredient.name}</strong></div><div className="ingredient-dose"><small>{ingredient.sharedDose ? '各' : '原书量'}</small><b>{ingredient.dose}</b></div></>;
  return herb ? <button className="ingredient-tile" title={ingredient.match.note || ingredient.name} aria-label={`查看${ingredient.name}药材资料`} onClick={() => onHerb({ ...herb, context: { originalName: ingredient.name, match: ingredient.match } })}>{content}</button> : <article className="ingredient-tile" title={ingredient.match.note}>{content}</article>;
}
export function PropertyReferences({ ingredients }: { ingredients: Ingredient[] }) {
  return <details className="property-references"><summary>药名与药性来源</summary><p>按 Open Herbology 的性味分组：微温归温，微寒与微凉归凉；卡片仍显示原始药性。“基药参考”保留炮制或部位差异，不能视为该炮制品的独立药性。</p><dl>{ingredients.map((i, index) => <div key={index}><dt>{i.name}<span>{i.natureLabel}{i.match.scope === 'base-herb' ? ' · 基药参考' : ''}</span></dt><dd>{i.match.referenceName && <strong>参考条目：{i.match.referenceName}　</strong>}{i.match.note || 'Open Herbology 同名药材记录。'}{i.match.evidence && <small>{i.match.evidence.startsWith('https://') ? <a href={i.match.evidence} target="_blank" rel="noreferrer">核对来源</a> : i.match.evidence}</small>}</dd></div>)}</dl></details>;
}
export function FormulaCard({ formula: f, onOpen, favorite, mastered, onFavorite }: { formula: Formula; onOpen: () => void; favorite: boolean; mastered: boolean; onFavorite: () => void }) {
  return <article className="formula-card"><button className="formula-open" onClick={onOpen}><div className="formula-card-top"><span>{categoryById.get(f.categoryId)?.name}</span><ArrowUpRight size={18}/></div><h3>{f.name}</h3><small className="pinyin">{romanize(f.name)}</small><p>{f.rhyme[0] || f.preface[0] || '原书条目'}</p><div className="mini-ingredients">{f.ingredients.slice(0, 5).map((i, n) => <span key={n} className={`thermal-${i.thermal}`}>{i.name}</span>)}{f.ingredients.length > 5 && <small>+{f.ingredients.length - 5}</small>}{!f.ingredients.length && <small>阅读原文组成</small>}</div></button><div className="card-footer"><span>{mastered ? <><Check size={14}/>已熟记</> : f.supplement ? '增辑' : '原编'}</span><button className={`favorite-button ${favorite ? 'active' : ''}`} aria-label={`${favorite ? '取消收藏' : '收藏'}${f.name}`} aria-pressed={favorite} onClick={onFavorite}><Bookmark size={17} fill={favorite ? 'currentColor' : 'none'}/></button></div></article>;
}
export function FormulaSections({ formula }: { formula: Formula }) {
  const visible = formula.sections.filter(s => !['歌诀', '方歌', '组成'].includes(s.title));
  return <>{visible.map(s => <section className="detail-section" key={s.anchor}><h3>{s.title === '方析' ? '白话方析' : s.title}</h3><SourceBlocks blocks={s.blocks}/></section>)}{!visible.length && <p className="muted">此条目以原书歌诀为主。</p>}</>;
}
export function FormulaSummary({ formula }: { formula: Formula }) {
  return <div className="summary-columns">{['功用', '主治'].map(name => <section key={name}><small>{name}</small><p>{sectionText(formula, name) || '本条未单列'}</p></section>)}</div>;
}
