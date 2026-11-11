import raw from './data/book.json';
import { pinyin } from 'pinyin-pro';

export type Thermal = 'hot' | 'warm' | 'neutral' | 'cool' | 'cold' | 'unknown';
export interface Block { text: string; html: string }
export interface Section { title: string; anchor: string; blocks: Block[] }
export interface HerbMatch { method: string; scope: 'ingredient' | 'base-herb' | 'unresolved'; referenceName: string | null; evidence: string; note: string }
export interface Ingredient { name: string; dose: string; sharedDose: boolean; herbId: string | null; thermal: Thermal; natureLabel: string; match: HerbMatch }
export interface Formula { id: string; name: string; title: string; categoryId: string; supplement: boolean; source: { file: string; anchor: string }; preface: string[]; sections: Section[]; ingredients: Ingredient[]; rhyme: string[]; reviewStatus: string; compositionNote: string | null }
export interface Herb { id: string; name: string; nature: string; thermal: Thermal; natureLabel: string; action: string; prescription: string; aliases: string[]; source: string; reviewStatus: string; context?: { originalName: string; match: HerbMatch } }
export interface Category { id: string; name: string; intro: Block[] }
interface Book { source: { title: string; edition: string; filename: string; sha256: string }; categories: Category[]; formulas: Formula[]; herbs: Herb[]; report: { structuredCompositions: number; withRhyme: number; herbMatching: { ingredientOccurrences: number; linkedOccurrences: number; withThermal: number; pending: Record<string, number> } } }
export const book = raw as unknown as Book;
export const thermalLabels: Record<Thermal, string> = { hot: '热', warm: '温', neutral: '平', cool: '凉', cold: '寒', unknown: '未匹配' };
export const categoryById = new Map(book.categories.map(c => [c.id, c]));
export const herbById = new Map(book.herbs.map(h => [h.id, h]));
export const romanize = (name: string) => pinyin(name, { toneType: 'symbol' });
export const sectionText = (formula: Formula, name: string) => formula.sections.find(s => s.title === name)?.blocks.map(b => b.text).join('\n') || '';
export const searchIndex = new Map(book.formulas.map(f => [f.id, [f.name, f.title, ...f.preface, ...f.sections.flatMap(s => s.blocks.map(b => b.text)), pinyin(f.name, { toneType: 'none' }), pinyin(f.name, { toneType: 'none', type: 'array' }).join(''), pinyin(f.name, { pattern: 'first', toneType: 'none', type: 'array' }).join('')].join(' ').toLowerCase()]));
export function filterFormulas(query: string, category: string, favorites: string[] | null = null) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return book.formulas.filter(f => (!category || f.categoryId === category) && (!favorites || favorites.includes(f.id)) && terms.every(t => searchIndex.get(f.id)?.includes(t)));
}
