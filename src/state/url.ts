/**
 * The whole shareable view state lives in the URL hash, e.g.
 *   #explore?lat=42.87&lon=74.59&v=T2M&from=1981&to=2025&basis=annual&anom=1
 *   #compare?a=78.22,15.65&b=42.87,74.59&v=T2M
 *   #cases?id=svalbard&step=2
 */
import { isVarCode, type VarCode } from '../data/catalog';
import type { AnalysisBasis } from '../stats/analyze';

export type Mode = 'explore' | 'cases' | 'compare' | 'learn';
export const MODES: Mode[] = ['explore', 'cases', 'compare', 'learn'];

export interface PlaceRef {
  lat: number;
  lon: number;
  name?: string;
}

export interface UrlState {
  mode: Mode;
  place?: PlaceRef;
  varCode?: VarCode;
  period?: [number, number];
  basis?: AnalysisBasis;
  anomalies?: boolean;
  compareA?: PlaceRef;
  compareB?: PlaceRef;
  caseId?: string;
  caseStep?: number;
  scan?: boolean;
  map?: string;
}

const num = (s: string | null): number | undefined => {
  if (s === null || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const validLatLon = (lat?: number, lon?: number): lat is number => lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

function parsePair(s: string | null): PlaceRef | undefined {
  if (!s) return undefined;
  const [la, lo, ...rest] = s.split(',');
  const lat = num(la);
  const lon = num(lo);
  if (!validLatLon(lat, lon)) return undefined;
  return { lat, lon: lon!, name: rest.length ? decodeURIComponent(rest.join(',')) : undefined };
}

export function parseHash(hash: string): UrlState {
  const h = hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const mode = (MODES as string[]).includes(path) ? (path as Mode) : 'explore';
  const q = new URLSearchParams(query);
  const s: UrlState = { mode };
  const lat = num(q.get('lat'));
  const lon = num(q.get('lon'));
  if (validLatLon(lat, lon)) s.place = { lat, lon: lon!, name: q.get('name') ?? undefined };
  const v = q.get('v');
  if (v && isVarCode(v)) s.varCode = v;
  const from = num(q.get('from'));
  const to = num(q.get('to'));
  if (from !== undefined && to !== undefined && to > from) s.period = [Math.round(from), Math.round(to)];
  const basis = q.get('basis');
  if (basis === 'annual' || basis === 'monthly-anomalies') s.basis = basis;
  if (q.has('anom')) s.anomalies = q.get('anom') === '1';
  s.compareA = parsePair(q.get('a'));
  s.compareB = parsePair(q.get('b'));
  const id = q.get('id');
  if (id) s.caseId = id;
  const step = num(q.get('step'));
  if (step !== undefined) s.caseStep = Math.max(0, Math.round(step));
  if (q.get('scan') === '1') s.scan = true;
  const map = q.get('map');
  if (map) s.map = map;
  return s;
}

const r4 = (x: number) => String(Math.round(x * 1e4) / 1e4);

export function buildHash(s: UrlState): string {
  const q = new URLSearchParams();
  if (s.mode === 'explore' || s.mode === 'learn') {
    if (s.mode === 'explore' && s.place) {
      q.set('lat', r4(s.place.lat));
      q.set('lon', r4(s.place.lon));
      if (s.place.name) q.set('name', s.place.name);
    }
  }
  if (s.mode === 'compare') {
    if (s.compareA) q.set('a', `${r4(s.compareA.lat)},${r4(s.compareA.lon)}`);
    if (s.compareB) q.set('b', `${r4(s.compareB.lat)},${r4(s.compareB.lon)}`);
  }
  if (s.mode === 'cases') {
    if (s.caseId) q.set('id', s.caseId);
    if (s.caseStep !== undefined) q.set('step', String(s.caseStep));
  }
  if (s.mode === 'explore' || s.mode === 'compare') {
    if (s.varCode) q.set('v', s.varCode);
    if (s.period) {
      q.set('from', String(s.period[0]));
      q.set('to', String(s.period[1]));
    }
    if (s.basis && s.basis !== 'annual') q.set('basis', s.basis);
    if (s.anomalies === false) q.set('anom', '0');
    if (s.mode === 'explore' && s.scan) q.set('scan', '1');
    if (s.mode === 'explore' && s.map) q.set('map', s.map);
  }
  const qs = q.toString();
  return `#${s.mode}${qs ? `?${qs}` : ''}`;
}
