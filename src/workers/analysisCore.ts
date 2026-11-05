/**
 * Pure scan / trend-map logic shared by the worker and the tests.
 */
import { ALL_CODES, CATALOG, defaultStartYear, type VarCode } from '../data/catalog';
import { pointRecords, regionalCellRecords } from '../data/adapters';
import type { PointDataset, RegionalDataset } from '../data/types';
import { analyzeMonthly, annualAggregate, benjaminiHochberg, mannKendall, senSlope, sliceYears, stepChangeCheck, verdictFromP, wilksFdr, type Verdict, type WarningCode } from '../stats';

export interface ScanInput {
  data: PointDataset;
  /** Optional common period; default = each variable's own default period. */
  period?: [number, number] | null;
}

export interface ScanRow {
  code: VarCode;
  from: number;
  to: number;
  n: number;
  /** Slope per decade in annual units */
  perDecade: number;
  ciLow: number;
  ciHigh: number;
  totalChange: number;
  p: number;
  q: number;
  mkP: number;
  signalToNoise: number;
  /** Verdict from the BH-adjusted q-value */
  verdict: Verdict;
  /** Verdict from the unadjusted p-value (for comparison) */
  verdictRaw: Verdict;
  warnings: WarningCode[];
  /** Yearly values for the sparkline */
  spark: [number, number][];
}

export function scanPoint({ data, period }: ScanInput): ScanRow[] {
  const rows: Omit<ScanRow, 'q' | 'verdict'>[] = [];
  for (const code of ALL_CODES) {
    const meta = CATALOG[code];
    const from = Math.max(period?.[0] ?? defaultStartYear(code), meta.firstYear);
    const to = Math.min(period?.[1] ?? data.end, data.end);
    const recs = sliceYears(pointRecords(data, code), from, to);
    const a = analyzeMonthly(recs, meta.agg, 'annual');
    const t = a.trend;
    rows.push({
      code,
      from,
      to,
      n: t.n,
      perDecade: t.slopePerDecade,
      ciLow: t.slopePerDecadeCi[0],
      ciHigh: t.slopePerDecadeCi[1],
      totalChange: t.totalChange,
      p: t.p,
      mkP: t.mk.p,
      signalToNoise: t.signalToNoise,
      verdictRaw: t.verdict,
      warnings: t.warnings,
      spark: a.x.map((x, i) => [x, a.y[i]]),
    });
  }
  const qs = benjaminiHochberg(rows.map((r) => r.p));
  const out: ScanRow[] = rows.map((r, i) => ({ ...r, q: qs[i], verdict: verdictFromP(qs[i]) }));
  // Strongest evidence first: verdict, then clean records before ones that look
  // like a source jump, then q, then |signal-to-noise|; insufficient last.
  const rank: Record<Verdict, number> = { significant: 0, suggestive: 1, 'not-significant': 2, insufficient: 3 };
  out.sort((a, b) => {
    if (rank[a.verdict] !== rank[b.verdict]) return rank[a.verdict] - rank[b.verdict];
    const sa = a.warnings.includes('possible-step') ? 1 : 0;
    const sb = b.warnings.includes('possible-step') ? 1 : 0;
    if (sa !== sb) return sa - sb;
    const qa = Number.isFinite(a.q) ? a.q : 2;
    const qb = Number.isFinite(b.q) ? b.q : 2;
    if (qa !== qb) return qa - qb;
    return Math.abs(b.signalToNoise || 0) - Math.abs(a.signalToNoise || 0);
  });
  return out;
}

export interface TrendMapInput {
  data: RegionalDataset;
  period: [number, number];
  alphaFdr?: number;
}

export interface TrendCell {
  idx: number;
  lat: number;
  lon: number;
  /** Sen's slope per decade (annual units) */
  sen: number;
  p: number;
  significant: boolean;
  step: boolean;
  n: number;
}

export interface TrendMapResult {
  cells: TrendCell[];
  threshold: number;
  nSignificant: number;
  nPos: number;
  nNeg: number;
  nTests: number;
  /** Robust symmetric colour scale limit (95th percentile of |slope|) */
  scaleMax: number;
  dLat: number;
  dLon: number;
}

/** Sen's slope + Mann-Kendall p per grid cell, then Wilks (2016) FDR. */
export function trendMapCells({ data, period, alphaFdr = 0.1 }: TrendMapInput): TrendMapResult {
  const agg = (CATALOG as Record<string, { agg: 'mean' | 'sum' | 'rateSum' }>)[data.param]?.agg ?? 'mean';
  const cells: TrendCell[] = [];
  data.values.forEach((_, idx) => {
    const i = Math.floor(idx / data.lons.length);
    const j = idx % data.lons.length;
    const ann = annualAggregate(sliceYears(regionalCellRecords(data, idx), period[0], period[1]), agg).filter((a) => Number.isFinite(a.value));
    const y = ann.map((a) => a.value);
    const x = ann.map((a) => a.year);
    const constant = y.length > 0 && y.every((v) => v === y[0]);
    if (y.length < 10 || constant) {
      cells.push({ idx, lat: data.lats[i], lon: data.lons[j], sen: constant ? 0 : NaN, p: NaN, significant: false, step: false, n: y.length });
      return;
    }
    cells.push({
      idx,
      lat: data.lats[i],
      lon: data.lons[j],
      sen: senSlope(x, y).slope * 10,
      p: mannKendall(y).p,
      significant: false,
      step: !!stepChangeCheck(x, y)?.flagged,
      n: y.length,
    });
  });
  const fdr = wilksFdr(
    cells.map((c) => c.p),
    alphaFdr,
  );
  let nPos = 0;
  let nNeg = 0;
  cells.forEach((c, k) => {
    c.significant = fdr.significant[k];
    if (c.significant && c.sen > 0) nPos++;
    if (c.significant && c.sen < 0) nNeg++;
  });
  const mags = cells
    .map((c) => Math.abs(c.sen))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  const scaleMax = mags.length ? mags[Math.min(mags.length - 1, Math.floor(0.95 * (mags.length - 1)))] || mags[mags.length - 1] || 1 : 1;
  return {
    cells,
    threshold: fdr.threshold,
    nSignificant: fdr.nSignificant,
    nPos,
    nNeg,
    nTests: fdr.nTests,
    scaleMax,
    dLat: data.lats.length > 1 ? data.lats[1] - data.lats[0] : 0.5,
    dLon: data.lons.length > 1 ? data.lons[1] - data.lons[0] : 0.625,
  };
}
