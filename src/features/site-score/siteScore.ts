/**
 * Site climate-suitability score (pure, unit-tested).
 * Polygon geometry → sample MERRA-2 grid cells → climate statistics →
 * 0–100 sub-scores → weighted total per building type.
 */
import type { PointDataset } from '../../data/types';
import { pointRecords } from '../../data/adapters';
import { analyzeMonthly, annualAggregate, sliceYears } from '../../stats';
import { BANDS, CLIMATOLOGY_YEARS, FACTORS, GEOMETRIC_FLOOR, RAMPS, TREND_RULES, WEIGHTS, type BuildingType, type FactorId, type Ramp, type ScoreBand } from '../../content/siteRules';

/** Polygon ring as [lon, lat] vertices (not closed: first ≠ last). */
export type Ring = [number, number][];

// ---------------------------------------------------------------- geometry

const KM_PER_DEG = 111.32;

export function bboxOf(ring: Ring) {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return { lonMin: Math.min(...lons), lonMax: Math.max(...lons), latMin: Math.min(...lats), latMax: Math.max(...lats) };
}

/** Area in km² (local equirectangular projection — fine for regions up to a few hundred km). */
export function areaKm2(ring: Ring): number {
  if (ring.length < 3) return 0;
  const lat0 = (bboxOf(ring).latMin + bboxOf(ring).latMax) / 2;
  const kx = KM_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * kx * (y2 * KM_PER_DEG) - x2 * kx * (y1 * KM_PER_DEG);
  }
  return Math.abs(s) / 2;
}

/** Area-weighted centroid [lon, lat]; falls back to the vertex mean for degenerate rings. */
export function centroid(ring: Ring): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-12) {
    return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function pointInPolygon([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** MERRA-2 grid: 0.5° latitude × 0.625° longitude. */
export const GRID = { dLat: 0.5, dLon: 0.625 };
const snap = (v: number, d: number) => Math.round(v / d) * d;
export const cellKey = (lon: number, lat: number) => `${snap(lat, GRID.dLat).toFixed(3)},${snap(lon, GRID.dLon).toFixed(3)}`;

/**
 * Points to request: the centroid plus the centre of every MERRA-2 cell inside
 * the polygon, one point per grid cell, at most `max` (evenly thinned).
 */
export function samplePoints(ring: Ring, max = 6): [number, number][] {
  const c = centroid(ring);
  const b = bboxOf(ring);
  const pts: [number, number][] = [c];
  const seen = new Set([cellKey(c[0], c[1])]);
  for (let lat = snap(b.latMin, GRID.dLat); lat <= b.latMax + 1e-9; lat += GRID.dLat) {
    for (let lon = snap(b.lonMin, GRID.dLon); lon <= b.lonMax + 1e-9; lon += GRID.dLon) {
      const p: [number, number] = [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000];
      const k = cellKey(p[0], p[1]);
      if (!seen.has(k) && pointInPolygon(p, ring)) {
        seen.add(k);
        pts.push(p);
      }
    }
  }
  if (pts.length <= max) return pts;
  const rest = pts.slice(1);
  const step = rest.length / (max - 1);
  return [pts[0], ...Array.from({ length: max - 1 }, (_, i) => rest[Math.floor(i * step)])];
}

// ---------------------------------------------------------------- climate statistics

export interface ClimateStats {
  hottestHour: number;
  maxDewPoint: number;
  coldestHour: number;
  frostDays: number;
  wettestMonth: number;
  soilWetness: number;
  annualPrecip: number;
  maxSnow: number;
  meanWind: number;
  /** kWh/m²/day */
  solar: number;
}

const mean = (xs: number[]) => {
  const f = xs.filter(Number.isFinite);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN;
};

/** Per-year extreme of monthly values, averaged over the years. */
function meanOfYearly(d: PointDataset, code: Parameters<typeof pointRecords>[1], from: number, to: number, pick: (xs: number[]) => number): number {
  const recs = sliceYears(pointRecords(d, code), from, to);
  const byYear = new Map<number, number[]>();
  for (const r of recs) if (Number.isFinite(r.value)) (byYear.get(r.year) ?? byYear.set(r.year, []).get(r.year)!).push(r.value);
  return mean([...byYear.values()].filter((v) => v.length === 12).map(pick));
}

export function climateStats(d: PointDataset): ClimateStats {
  const to = d.end;
  const from = to - CLIMATOLOGY_YEARS + 1;
  const max = (xs: number[]) => Math.max(...xs);
  const min = (xs: number[]) => Math.min(...xs);
  const avg = (xs: number[]) => mean(xs);
  return {
    hottestHour: meanOfYearly(d, 'T2M_MAX', from, to, max),
    maxDewPoint: meanOfYearly(d, 'T2MDEW', from, to, max),
    coldestHour: meanOfYearly(d, 'T2M_MIN', from, to, min),
    frostDays: mean(annualAggregate(sliceYears(pointRecords(d, 'FROST_DAYS'), from, to), 'sum').map((a) => a.value)),
    wettestMonth: meanOfYearly(d, 'PRECTOTCORR', from, to, max),
    soilWetness: meanOfYearly(d, 'GWETTOP', from, to, avg),
    annualPrecip: mean(annualAggregate(sliceYears(pointRecords(d, 'PRECTOTCORR'), from, to), 'rateSum').map((a) => a.value)),
    maxSnow: meanOfYearly(d, 'SNODP', from, to, max),
    meanWind: meanOfYearly(d, 'WS10M', from, to, avg),
    solar: meanOfYearly(d, 'ALLSKY_SFC_SW_DWN', Math.max(2001, from), to, avg) / 3.6,
  };
}

/** Average the statistics of several sample points; also return their ranges. */
export function combineStats(list: ClimateStats[]): { mean: ClimateStats; min: ClimateStats; max: ClimateStats } {
  const keys = Object.keys(list[0]) as (keyof ClimateStats)[];
  const agg = (f: (xs: number[]) => number) => Object.fromEntries(keys.map((k) => [k, f(list.map((s) => s[k]).filter(Number.isFinite))])) as unknown as ClimateStats;
  return { mean: agg(mean), min: agg((xs) => Math.min(...xs)), max: agg((xs) => Math.max(...xs)) };
}

// ---------------------------------------------------------------- trends

export interface TrendInfo {
  /** Hottest-hour trend, °C per decade */
  heatPerDecade: number;
  heatSignificant: boolean;
  /** Annual precipitation trend, % of the mean per decade */
  precipPctPerDecade: number;
  precipSignificant: boolean;
  /** Mean annual precipitation over the record, mm/yr */
  precipMean: number;
  from: number;
  to: number;
}

export function trendInfo(d: PointDataset): TrendInfo {
  const heat = analyzeMonthly(pointRecords(d, 'T2M_MAX'), 'mean', 'annual').trend;
  const pr = analyzeMonthly(pointRecords(d, 'PRECTOTCORR'), 'rateSum', 'annual');
  const meanPr = mean(pr.y);
  return {
    heatPerDecade: heat.slopePerDecade,
    heatSignificant: heat.verdict === 'significant',
    precipPctPerDecade: meanPr > 0 ? (pr.trend.slopePerDecade / meanPr) * 100 : NaN,
    precipSignificant: pr.trend.verdict === 'significant',
    precipMean: meanPr,
    from: Math.round(heat.xStart),
    to: Math.round(heat.xEnd),
  };
}

// ---------------------------------------------------------------- scoring

export function ramp(value: number, r: Ramp): number {
  if (!Number.isFinite(value)) return NaN;
  const t = (value - r.bad) / (r.good - r.bad);
  return Math.max(0, Math.min(100, t * 100));
}

const blend = (parts: [number, number][]) => {
  const ok = parts.filter(([v]) => Number.isFinite(v));
  const w = ok.reduce((s, [, k]) => s + k, 0);
  return w ? ok.reduce((s, [v, k]) => s + v * k, 0) / w : NaN;
};

export function subScores(s: ClimateStats, tr: TrendInfo): Record<FactorId, number> {
  const heatPenalty = tr.heatSignificant && tr.heatPerDecade > 0 ? Math.min(TREND_RULES.heatMaxPenalty, (tr.heatPerDecade / 0.1) * TREND_RULES.heatPerTenth) : 0;
  const excess = Math.max(0, Math.abs(tr.precipPctPerDecade) - TREND_RULES.precipFreeBand);
  const precipPenalty = tr.precipSignificant && tr.precipMean >= TREND_RULES.precipMinAnnualMm && Number.isFinite(excess) ? Math.min(TREND_RULES.precipMaxPenalty, excess * TREND_RULES.precipPerPercent) : 0;
  return {
    heat: blend([
      [ramp(s.hottestHour, RAMPS.hottestHour), 0.6],
      [ramp(s.maxDewPoint, RAMPS.maxDewPoint), 0.4],
    ]),
    cold: blend([
      [ramp(s.coldestHour, RAMPS.coldestHour), 0.5],
      [ramp(s.frostDays, RAMPS.frostDays), 0.5],
    ]),
    rain: blend([
      [ramp(s.wettestMonth, RAMPS.wettestMonth), 0.6],
      [ramp(s.soilWetness, RAMPS.soilWetness), 0.4],
    ]),
    water: ramp(s.annualPrecip, RAMPS.annualPrecip),
    snow: ramp(s.maxSnow, RAMPS.maxSnow),
    wind: ramp(s.meanWind, RAMPS.meanWind),
    solar: ramp(s.solar, RAMPS.solar),
    trend: Math.max(0, 100 - heatPenalty - precipPenalty),
  };
}

export interface SiteScore {
  total: number;
  band: ScoreBand['id'];
  sub: Record<FactorId, number>;
  /** Points each factor costs the total: weight × (100 − sub-score) */
  losses: Record<FactorId, number>;
  /** Largest losses first (weight > 0 only) */
  concerns: FactorId[];
  strengths: FactorId[];
}

export function scoreSite(stats: ClimateStats, tr: TrendInfo, type: BuildingType): SiteScore {
  const sub = subScores(stats, tr);
  const w = WEIGHTS[type];
  // weighted geometric mean: exp(Σ w·ln(s/100)) / Σ w
  let logSum = 0;
  let wsum = 0;
  const losses = {} as Record<FactorId, number>;
  for (const f of FACTORS) {
    if (!Number.isFinite(sub[f]) || w[f] === 0) {
      losses[f] = 0;
      continue;
    }
    logSum += w[f] * Math.log(Math.max(GEOMETRIC_FLOOR, sub[f]) / 100);
    wsum += w[f];
    losses[f] = w[f] * (100 - sub[f]);
  }
  const score = wsum ? Math.round(100 * Math.exp(logSum / wsum)) : NaN;
  const ranked = FACTORS.filter((f) => w[f] > 0 && Number.isFinite(sub[f]));
  return {
    total: score,
    band: (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]).id,
    sub,
    losses,
    concerns: ranked.filter((f) => sub[f] < 60).sort((a, b) => losses[b] - losses[a]),
    strengths: ranked.filter((f) => sub[f] >= 80 && w[f] >= 0.1).sort((a, b) => w[b] - w[a]),
  };
}
