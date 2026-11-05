/**
 * Data loading strategy (DECISIONS D0.1/D0.2):
 *   bundled (exact preset) → IndexedDB cache → live POWER → bundled fallback (same grid cell).
 * The provenance of every dataset is returned so the UI can label it honestly.
 */
import { cacheGet, cacheSet, normalizeUrlKey } from './cache';
import { fetchPointLive, fetchRegionalLive, pointUrl, regionalUrl } from './power';
import type { BBox, Loaded, PointDataset, PointRequest, RegionalDataset, RegionalRequest } from './types';

export interface ManifestPoint {
  id: string;
  lat: number;
  lon: number;
  file: string;
  start: number;
  end: number;
  params: string[];
}

export interface ManifestRegion {
  id: string;
  param: string;
  bbox: BBox;
  file: string;
  start: number;
  end: number;
}

export interface ManifestImage {
  id: string;
  file: string;
  date: string;
  layer: string;
  bbox: BBox;
}

export interface Manifest {
  generatedAt: string;
  apiVersion: string;
  points: ManifestPoint[];
  regions: ManifestRegion[];
  images: ManifestImage[];
}

const baseUrl = (): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.BASE_URL ?? '/';
};

export function dataUrl(file: string): string {
  return `${baseUrl()}data/${file}`;
}

let manifestPromise: Promise<Manifest | null> | null = null;

export function loadManifest(): Promise<Manifest | null> {
  manifestPromise ??= fetch(dataUrl('manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifestPromise;
}

async function fetchBundled<T>(file: string): Promise<T> {
  const r = await fetch(dataUrl(file));
  if (!r.ok) throw new Error(`Bundled file missing: ${file}`);
  return (await r.json()) as T;
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

function coversPoint(p: ManifestPoint, req: PointRequest, tolLat: number, tolLon: number): boolean {
  return (
    near(p.lat, req.lat, tolLat) &&
    near(p.lon, req.lon, tolLon) &&
    p.start <= req.start &&
    p.end >= req.end &&
    req.params.every((c) => p.params.includes(c))
  );
}

/** Trim a dataset to the requested years and parameters. */
function subsetPoint(d: PointDataset, req: PointRequest): PointDataset {
  const off = (req.start - d.start) * 12;
  const len = (req.end - req.start + 1) * 12;
  const params: PointDataset['params'] = {};
  for (const c of req.params) params[c] = (d.params[c] ?? []).slice(off, off + len);
  return { ...d, start: req.start, end: req.end, params };
}

export function isOfflineError(err: unknown): boolean {
  return err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

export async function loadPoint(req: PointRequest, opts: { signal?: AbortSignal; preferLive?: boolean } = {}): Promise<Loaded<PointDataset>> {
  const manifest = await loadManifest();
  // 1. exact bundled preset (offline-proof demo)
  const exact = manifest?.points.find((p) => coversPoint(p, req, 0.005, 0.005));
  if (exact && !opts.preferLive) {
    return { data: subsetPoint(await fetchBundled<PointDataset>(exact.file), req), provenance: 'bundled' };
  }
  // 2. cache
  const key = normalizeUrlKey(pointUrl(req));
  if (!opts.preferLive) {
    const cached = await cacheGet<PointDataset>(key);
    if (cached) return { data: cached, provenance: 'cached' };
  }
  // 3. live
  try {
    const data = await fetchPointLive(req, opts.signal);
    await cacheSet(key, data);
    return { data, provenance: 'live' };
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    // 4. bundled fallback within the same MERRA-2 grid cell (0.5° × 0.625°)
    const fb = manifest?.points.find((p) => coversPoint(p, req, 0.25, 0.3125));
    if (fb) {
      return {
        data: subsetPoint(await fetchBundled<PointDataset>(fb.file), req),
        provenance: 'bundled',
        fallbackReason: err instanceof Error ? err.message : String(err),
      };
    }
    const cached = await cacheGet<PointDataset>(key);
    if (cached) return { data: cached, provenance: 'cached', fallbackReason: err instanceof Error ? err.message : String(err) };
    throw err;
  }
}

function sameBBox(a: BBox, b: BBox, tol = 0.01): boolean {
  return near(a.latMin, b.latMin, tol) && near(a.latMax, b.latMax, tol) && near(a.lonMin, b.lonMin, tol) && near(a.lonMax, b.lonMax, tol);
}

export async function loadRegional(req: RegionalRequest, opts: { signal?: AbortSignal } = {}): Promise<Loaded<RegionalDataset>> {
  const manifest = await loadManifest();
  const bundled = manifest?.regions.find((r) => r.param === req.param && sameBBox(r.bbox, req.bbox) && r.start <= req.start && r.end >= req.end);
  if (bundled) return { data: await fetchBundled<RegionalDataset>(bundled.file), provenance: 'bundled' };
  const key = normalizeUrlKey(regionalUrl(req));
  const cached = await cacheGet<RegionalDataset>(key);
  if (cached) return { data: cached, provenance: 'cached' };
  const data = await fetchRegionalLive(req, opts.signal);
  await cacheSet(key, data);
  return { data, provenance: 'live' };
}
