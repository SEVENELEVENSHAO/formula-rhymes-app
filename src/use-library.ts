import { useState } from 'react';
export interface Library { favorites: string[]; mastered: string[]; notes: Record<string, string>; recent: string[] }
const KEY = 'tangtou-library-v1';
const empty: Library = { favorites: [], mastered: [], notes: {}, recent: [] };
function read(): Library {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (validLibrary(value)) return value;
  } catch { /* A damaged or unavailable store must not prevent reading. */ }
  return empty;
}
export function validLibrary(value: unknown): value is Library {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['favorites', 'mastered', 'recent'].every(k => Array.isArray(v[k]) && (v[k] as unknown[]).every(i => typeof i === 'string')) && !!v.notes && typeof v.notes === 'object' && !Array.isArray(v.notes) && Object.values(v.notes).every(i => typeof i === 'string');
}
export function useLibrary() {
  const [library, setLibrary] = useState<Library>(read);
  const [storageError, setStorageError] = useState('');
  function update(next: Library) {
    setLibrary(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('当前浏览器无法保存学习记录。请导出备份，避免关闭后丢失。'); }
  }
  function toggle(key: 'favorites' | 'mastered', id: string) {
    update({ ...library, [key]: library[key].includes(id) ? library[key].filter(i => i !== id) : [...library[key], id] });
  }
  return { library, update, toggle, storageError };
}
