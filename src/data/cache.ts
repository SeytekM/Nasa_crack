/**
 * IndexedDB cache (idb-keyval). Silently degrades to a no-op where IndexedDB
 * is unavailable (Node scripts, some private browsing modes).
 */
import { createStore, del, get, set, keys, type UseStore } from 'idb-keyval';

const VERSION = 'v1';
let store: UseStore | null | undefined;

function getStore(): UseStore | null {
  if (store !== undefined) return store;
  try {
    store = typeof indexedDB === 'undefined' ? null : createStore('etd-cache', 'responses');
  } catch {
    store = null;
  }
  return store;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const s = getStore();
  if (!s) return undefined;
  try {
    return (await get<T>(`${VERSION}:${key}`, s)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const s = getStore();
  if (!s) return;
  try {
    await set(`${VERSION}:${key}`, value, s);
  } catch {
    /* quota exceeded or blocked: caching is best-effort */
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const s = getStore();
  if (!s) return;
  try {
    await del(`${VERSION}:${key}`, s);
  } catch {
    /* ignore */
  }
}

export async function cacheSize(): Promise<number> {
  const s = getStore();
  if (!s) return 0;
  try {
    return (await keys(s)).length;
  } catch {
    return 0;
  }
}

/**
 * Normalised cache key for a URL: sorted query params, lower-cased names,
 * numbers rounded to 4 decimals.
 */
export function normalizeUrlKey(url: string): string {
  const u = new URL(url);
  const params = [...u.searchParams.entries()]
    .map(([k, v]) => {
      const key = k.toLowerCase();
      const num = Number(v);
      const val = v !== '' && Number.isFinite(num) && /^-?[\d.]+$/.test(v) ? String(Math.round(num * 1e4) / 1e4) : v.toUpperCase();
      return [key, val] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));
  return `${u.host}${u.pathname}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`;
}
