import { create } from 'zustand';
import { ALL_CODES, defaultStartYear, type VarCode } from '../data/catalog';
import { loadPoint } from '../data/loader';
import { FIRST_YEAR, lastCompleteYear } from '../data/power';
import type { Loaded, PointDataset } from '../data/types';
import type { AnalysisBasis } from '../stats/analyze';
import { buildHash, parseHash, type Mode, type PlaceRef, type UrlState } from './url';
import { PRESETS } from '../content/places';

export type Theme = 'dark' | 'light';

export interface PointEntry {
  status: 'loading' | 'ready' | 'error';
  loaded?: Loaded<PointDataset>;
  error?: string;
}

export interface ChartToggles {
  raw: boolean;
  ma: boolean;
  annual: boolean;
  trend: boolean;
}

export interface AppState {
  mode: Mode;
  theme: Theme;
  place: PlaceRef;
  varCode: VarCode;
  /** null = default period for the variable */
  period: [number, number] | null;
  basis: AnalysisBasis;
  anomalies: boolean;
  show: ChartToggles;
  scanOpen: boolean;
  mapRegion: string | null;
  wizardOpen: boolean;
  compareA: PlaceRef;
  compareB: PlaceRef;
  caseId: string | null;
  caseStep: number;
  points: Record<string, PointEntry>;

  setMode: (m: Mode) => void;
  setTheme: (t: Theme) => void;
  setPlace: (p: PlaceRef) => void;
  setVar: (v: VarCode) => void;
  setPeriod: (p: [number, number] | null) => void;
  setBasis: (b: AnalysisBasis) => void;
  setAnomalies: (a: boolean) => void;
  toggleSeries: (k: keyof ChartToggles) => void;
  setScanOpen: (o: boolean) => void;
  setMapRegion: (r: string | null) => void;
  setWizardOpen: (o: boolean) => void;
  setCompare: (which: 'a' | 'b', p: PlaceRef) => void;
  swapCompare: () => void;
  openCase: (id: string | null, step?: number) => void;
  setCaseStep: (s: number) => void;
  applyUrl: (u: UrlState) => void;
  ensurePoint: (p: PlaceRef, opts?: { force?: boolean }) => Promise<void>;
}

export const END_YEAR = lastCompleteYear();
const bishkek = PRESETS[0];

export const pointKey = (p: { lat: number; lon: number }) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem('etd-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage blocked */
  }
  return 'dark';
}

const inflight = new Map<string, Promise<void>>();

export const useStore = create<AppState>((set, get) => ({
  mode: 'explore',
  theme: initialTheme(),
  place: { lat: bishkek.lat, lon: bishkek.lon, name: bishkek.name },
  varCode: 'T2M',
  period: null,
  basis: 'annual',
  anomalies: true,
  show: { raw: true, ma: true, annual: true, trend: true },
  scanOpen: false,
  mapRegion: null,
  wizardOpen: false,
  compareA: { lat: 44.5, lon: 78.125, name: 'Ili River plains' },
  compareB: { lat: 43.0, lon: 77.5, name: 'Zailiysky Alatau (above Almaty)' },
  caseId: null,
  caseStep: 0,
  points: {},

  setMode: (mode) => set({ mode }),
  setTheme: (theme) => {
    try {
      localStorage.setItem('etd-theme', theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
  setPlace: (place) => set({ place, scanOpen: false }),
  setVar: (varCode) => set({ varCode, period: null }),
  setPeriod: (period) => set({ period }),
  setBasis: (basis) => set({ basis }),
  setAnomalies: (anomalies) => set({ anomalies }),
  toggleSeries: (k) => set((s) => ({ show: { ...s.show, [k]: !s.show[k] } })),
  setScanOpen: (scanOpen) => set({ scanOpen }),
  setMapRegion: (mapRegion) => set({ mapRegion }),
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  setCompare: (which, p) => set(which === 'a' ? { compareA: p } : { compareB: p }),
  swapCompare: () => set((s) => ({ compareA: s.compareB, compareB: s.compareA })),
  openCase: (caseId, step = 0) => set({ caseId, caseStep: step, mode: 'cases' }),
  setCaseStep: (caseStep) => set({ caseStep }),
  applyUrl: (u) =>
    set((s) => ({
      mode: u.mode,
      place: u.place ?? s.place,
      varCode: u.varCode ?? s.varCode,
      period: u.period ?? (u.varCode && u.varCode !== s.varCode ? null : s.period),
      basis: u.basis ?? 'annual',
      anomalies: u.anomalies ?? true,
      compareA: u.compareA ?? s.compareA,
      compareB: u.compareB ?? s.compareB,
      caseId: u.mode === 'cases' ? (u.caseId ?? null) : s.caseId,
      caseStep: u.caseStep ?? 0,
      scanOpen: u.scan ?? false,
      mapRegion: u.map ?? null,
    })),
  ensurePoint: async (p, opts = {}) => {
    const key = pointKey(p);
    const existing = get().points[key];
    if (!opts.force && existing && existing.status !== 'error') return;
    if (inflight.has(key) && !opts.force) return inflight.get(key);
    set((s) => ({ points: { ...s.points, [key]: { status: 'loading', loaded: s.points[key]?.loaded } } }));
    const job = loadPoint({ lat: p.lat, lon: p.lon, params: ALL_CODES, start: FIRST_YEAR, end: END_YEAR }, { preferLive: opts.force })
      .then((loaded) => set((s) => ({ points: { ...s.points, [key]: { status: 'ready', loaded } } })))
      .catch((err: unknown) =>
        set((s) => ({
          points: { ...s.points, [key]: { status: 'error', error: err instanceof Error ? err.message : String(err), loaded: s.points[key]?.loaded } },
        })),
      )
      .finally(() => inflight.delete(key));
    inflight.set(key, job);
    return job;
  },
}));

/** Effective analysis period for a variable (default = homogeneous segment → last complete year). */
export function effectivePeriod(varCode: VarCode, period: [number, number] | null, dataEnd = END_YEAR): [number, number] {
  if (period) return [Math.max(FIRST_YEAR, period[0]), Math.min(dataEnd, period[1])];
  return [defaultStartYear(varCode), dataEnd];
}

/** Current view → URL state (for the hash and share links). */
export function toUrlState(s: AppState): UrlState {
  return {
    mode: s.mode,
    place: s.place,
    varCode: s.varCode,
    period: s.period ?? undefined,
    basis: s.basis,
    anomalies: s.anomalies,
    compareA: s.compareA,
    compareB: s.compareB,
    caseId: s.caseId ?? undefined,
    caseStep: s.caseStep,
    scan: s.scanOpen,
    map: s.mapRegion ?? undefined,
  };
}

let syncing = false;

/** Two-way sync between the store and location.hash. Call once at start-up. */
export function startUrlSync(): () => void {
  const fromHash = () => {
    if (!location.hash) return;
    syncing = true;
    useStore.getState().applyUrl(parseHash(location.hash));
    syncing = false;
  };
  fromHash();
  const unsub = useStore.subscribe((s) => {
    if (syncing) return;
    const h = buildHash(toUrlState(s));
    if (h !== location.hash) history.replaceState(null, '', h);
  });
  const onHash = () => fromHash();
  window.addEventListener('hashchange', onHash);
  return () => {
    unsub();
    window.removeEventListener('hashchange', onHash);
  };
}

export function shareUrl(): string {
  return `${location.origin}${location.pathname}${buildHash(toUrlState(useStore.getState()))}`;
}

export function usePointEntry(p: PlaceRef): PointEntry | undefined {
  return useStore((s) => s.points[pointKey(p)]);
}
