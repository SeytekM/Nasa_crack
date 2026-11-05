/**
 * NASA POWER monthly API client (verified behaviour: docs/DATA_NOTES.md).
 * Works in the browser and in Node (prefetch script).
 */
import { HttpError, RequestQueue, withRetry } from './queue';
import type { BBox, PointDataset, PointRequest, RegionalDataset, RegionalRequest } from './types';

export const POWER_ORIGIN = 'https://power.larc.nasa.gov';
export const MAX_POINT_PARAMS = 25;
export const REGION_MIN_DEG = 2;
export const REGION_MAX_DEG = 10;
export const FIRST_YEAR = 1981;

const queue = new RequestQueue(2);

function powerBase(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const proxy = env?.VITE_POWER_PROXY;
  return (proxy && proxy.trim()) || POWER_ORIGIN;
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** Last complete calendar year (default analysis end). */
export function lastCompleteYear(now = new Date()): number {
  return now.getUTCFullYear() - 1;
}

export function pointUrl(req: PointRequest): string {
  const params = [...new Set(req.params)].sort();
  if (params.length > MAX_POINT_PARAMS) throw new Error(`POWER allows at most ${MAX_POINT_PARAMS} parameters per request`);
  const q = new URLSearchParams({
    parameters: params.join(','),
    community: 'AG',
    longitude: String(round(req.lon)),
    latitude: String(round(req.lat)),
    start: String(req.start),
    end: String(req.end),
    format: 'JSON',
  });
  return `${powerBase()}/api/temporal/monthly/point?${q}`;
}

/** Clamp a bbox to POWER's 2°–10° per-axis limits, keeping its centre. */
export function clampBBox(b: BBox): BBox {
  const fix = (lo: number, hi: number, min: number, max: number, limLo: number, limHi: number): [number, number] => {
    let c = (lo + hi) / 2;
    let w = Math.min(REGION_MAX_DEG, Math.max(REGION_MIN_DEG, hi - lo));
    c = Math.min(limHi - w / 2, Math.max(limLo + w / 2, c));
    w = Math.min(w, max - min);
    return [round(c - w / 2, 3), round(c + w / 2, 3)];
  };
  const [latMin, latMax] = fix(b.latMin, b.latMax, -90, 90, -90, 90);
  const [lonMin, lonMax] = fix(b.lonMin, b.lonMax, -180, 180, -180, 180);
  return { latMin, latMax, lonMin, lonMax };
}

export function regionalUrl(req: RegionalRequest): string {
  const b = clampBBox(req.bbox);
  const q = new URLSearchParams({
    'latitude-min': String(b.latMin),
    'latitude-max': String(b.latMax),
    'longitude-min': String(b.lonMin),
    'longitude-max': String(b.lonMax),
    parameters: req.param,
    community: 'AG',
    start: String(req.start),
    end: String(req.end),
    format: 'JSON',
  });
  return `${powerBase()}/api/temporal/monthly/regional?${q}`;
}

interface PowerHeader {
  fill_value?: number;
  sources?: string[];
  api?: { version?: string };
  start?: string;
  end?: string;
}

interface PowerPointResponse {
  geometry?: { coordinates?: number[] };
  properties?: { parameter?: Record<string, Record<string, number>> };
  header?: PowerHeader;
  parameters?: Record<string, { units?: string; longname?: string }>;
  messages?: string[];
}

interface PowerRegionalResponse {
  features?: { geometry: { coordinates: number[] }; properties: { parameter: Record<string, Record<string, number>> } }[];
  header?: PowerHeader;
  parameters?: Record<string, { units?: string }>;
  messages?: string[];
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return queue.run(() =>
    withRetry(
      async () => {
        const res = await fetch(url, { signal });
        const text = await res.text();
        if (!res.ok) {
          let msg = `POWER request failed (HTTP ${res.status})`;
          try {
            const j = JSON.parse(text) as { messages?: string[] };
            if (j.messages?.length) msg = j.messages.join(' ');
          } catch {
            /* not JSON */
          }
          throw new HttpError(res.status, text, msg);
        }
        return JSON.parse(text) as T;
      },
      { signal },
    ),
  );
}

/** Monthly values from `start`-01 to `end`-12 (month 13 dropped, fill → null). */
export function toMonthlyArray(obj: Record<string, number> | undefined, start: number, end: number, fill = -999): (number | null)[] {
  const out: (number | null)[] = [];
  for (let y = start; y <= end; y++) {
    for (let m = 1; m <= 12; m++) {
      const v = obj?.[`${y}${String(m).padStart(2, '0')}`];
      out.push(typeof v === 'number' && v !== fill && Number.isFinite(v) ? v : null);
    }
  }
  return out;
}

export function parsePointResponse(json: PowerPointResponse, req: PointRequest, url: string): PointDataset {
  const fill = json.header?.fill_value ?? -999;
  const params: Record<string, (number | null)[]> = {};
  const units: Record<string, string> = {};
  for (const code of req.params) {
    params[code] = toMonthlyArray(json.properties?.parameter?.[code], req.start, req.end, fill);
    units[code] = json.parameters?.[code]?.units ?? '';
  }
  const coords = json.geometry?.coordinates ?? [];
  return {
    kind: 'point',
    v: 1,
    lat: round(req.lat),
    lon: round(req.lon),
    elevation: typeof coords[2] === 'number' ? coords[2] : null,
    start: req.start,
    end: req.end,
    params,
    units,
    sources: json.header?.sources ?? [],
    apiVersion: json.header?.api?.version ?? '',
    fetchedAt: new Date().toISOString(),
    url,
  };
}

export function parseRegionalResponse(json: PowerRegionalResponse, req: RegionalRequest, url: string): RegionalDataset {
  const fill = json.header?.fill_value ?? -999;
  const feats = json.features ?? [];
  const lats = [...new Set(feats.map((f) => round(f.geometry.coordinates[1], 4)))].sort((a, b) => a - b);
  const lons = [...new Set(feats.map((f) => round(f.geometry.coordinates[0], 4)))].sort((a, b) => a - b);
  const values: RegionalDataset['values'] = new Array(lats.length * lons.length).fill(null);
  for (const f of feats) {
    const i = lats.indexOf(round(f.geometry.coordinates[1], 4));
    const j = lons.indexOf(round(f.geometry.coordinates[0], 4));
    values[i * lons.length + j] = toMonthlyArray(f.properties.parameter[req.param], req.start, req.end, fill);
  }
  return {
    kind: 'regional',
    v: 1,
    param: req.param,
    bbox: clampBBox(req.bbox),
    lats,
    lons,
    start: req.start,
    end: req.end,
    values,
    units: json.parameters?.[req.param]?.units ?? '',
    sources: json.header?.sources ?? [],
    apiVersion: json.header?.api?.version ?? '',
    fetchedAt: new Date().toISOString(),
    url,
  };
}

/**
 * Live point request. If the requested end year is rejected (e.g. not yet
 * available), retries once with end − 1.
 */
export async function fetchPointLive(req: PointRequest, signal?: AbortSignal): Promise<PointDataset> {
  try {
    const url = pointUrl(req);
    return parsePointResponse(await fetchJson<PowerPointResponse>(url, signal), req, url);
  } catch (err) {
    if (err instanceof HttpError && err.status === 422 && req.end > req.start + 1) {
      const r2 = { ...req, end: req.end - 1 };
      const url = pointUrl(r2);
      return parsePointResponse(await fetchJson<PowerPointResponse>(url, signal), r2, url);
    }
    throw err;
  }
}

export async function fetchRegionalLive(req: RegionalRequest, signal?: AbortSignal): Promise<RegionalDataset> {
  const url = regionalUrl(req);
  return parseRegionalResponse(await fetchJson<PowerRegionalResponse>(url, signal), req, url);
}
