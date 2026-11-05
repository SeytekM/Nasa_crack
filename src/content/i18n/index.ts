import { en, type Dict } from './en';

/** Registered dictionaries. Add `ru` here once translated. */
const DICTS: Record<string, Dict> = { en };

let current: Dict = en;

export function setLanguage(lang: string): void {
  current = DICTS[lang] ?? en;
}

/** Access the active dictionary (plain object — no runtime lookup cost). */
export function useT(): Dict {
  return current;
}

export const t = (): Dict => current;

export type { Dict };
export type GlossaryId = keyof Dict['glossary'];
