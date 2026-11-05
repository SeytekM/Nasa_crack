import { finitePairs, median, rankAverage, roundHalfEven, tieGroups } from './descriptive';
import { normPpf, normTwoSidedP } from './special';

export interface MannKendallResult {
  n: number;
  s: number;
  varS: number;
  z: number;
  /** Two-sided p-value (normal approximation). */
  p: number;
  tau: number;
}

/** Mann-Kendall S statistic: Σ_{i<j} sign(y_j − y_i), data in time order. */
export function mkScore(y: ArrayLike<number>): number {
  const n = y.length;
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    const yi = y[i];
    for (let j = i + 1; j < n; j++) {
      const d = y[j] - yi;
      if (d > 0) s++;
      else if (d < 0) s--;
    }
  }
  return s;
}

/** Var(S) with tie correction: [n(n−1)(2n+5) − Σ t(t−1)(2t+5)] / 18. */
export function mkVariance(y: ArrayLike<number>): number {
  const n = y.length;
  let v = n * (n - 1) * (2 * n + 5);
  for (const t of tieGroups(y)) v -= t * (t - 1) * (2 * t + 5);
  return v / 18;
}

/** Z with continuity correction. */
export function mkZ(s: number, varS: number): number {
  if (s > 0) return (s - 1) / Math.sqrt(varS);
  if (s < 0) return (s + 1) / Math.sqrt(varS);
  return 0;
}

/**
 * Original Mann-Kendall test (Mann 1945; Kendall 1975; Gilbert 1987).
 * `y` must be in time order; non-finite values are skipped.
 * Matches pymannkendall.original_test.
 */
export function mannKendall(yIn: ArrayLike<number>): MannKendallResult {
  const y = Array.from(yIn).filter(Number.isFinite);
  const n = y.length;
  const s = mkScore(y);
  const varS = mkVariance(y);
  const z = mkZ(s, varS);
  return { n, s, varS, z, p: n < 2 || varS <= 0 ? NaN : normTwoSidedP(z), tau: s / (0.5 * n * (n - 1)) };
}

/**
 * Modified Mann-Kendall test for autocorrelated data (Hamed & Rao 1998),
 * following pymannkendall.hamed_rao_modification_test (all lags, only
 * significant autocorrelations of the ranks of the detrended series).
 */
export function mannKendallHamedRao(yIn: ArrayLike<number>, alpha = 0.05): MannKendallResult & { correction: number } {
  const base = mannKendall(yIn);
  const all = Array.from(yIn);
  const y = all.filter(Number.isFinite);
  const n = y.length;
  const slope = senSlopeIndex(all).slope;
  const detr = y.map((v, i) => v - (i + 1) * slope);
  const ranks = rankAverage(detr);
  const m = ranks.reduce((a, b) => a + b, 0) / n;
  const dev = ranks.map((r) => r - m);
  let c0 = 0;
  for (const d of dev) c0 += d * d;
  const bound = normPpf(1 - alpha / 2) / Math.sqrt(n);
  let sni = 0;
  for (let lag = 1; lag < n; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += dev[i] * dev[i + lag];
    const acf = c / c0;
    if (acf > bound || acf < -bound) sni += (n - lag) * (n - lag - 1) * (n - lag - 2) * acf;
  }
  const correction = 1 + (2 / (n * (n - 1) * (n - 2))) * sni;
  const varS = base.varS * correction;
  const z = mkZ(base.s, varS);
  return { ...base, varS, z, p: varS > 0 ? normTwoSidedP(z) : NaN, correction };
}

export interface SenResult {
  slope: number;
  intercept: number;
  ciLow: number;
  ciHigh: number;
  /** Number of finite pairwise slopes. */
  nSlopes: number;
}

/**
 * Theil–Sen slope with x positions (handles gaps) and its confidence interval
 * following Sen (1968) / Gilbert (1987) as implemented by scipy.stats.theilslopes:
 *   C = z_{1−α/2}·sqrt(Var S), lower = slopes[round((N − C)/2) − 1],
 *   upper = slopes[round((N + C)/2)]  (0-based, sorted ascending).
 * Intercept = median(y) − slope·median(x) (Conover 1980).
 */
export function senSlope(xIn: ArrayLike<number>, yIn: ArrayLike<number>, confidence = 0.95): SenResult {
  const { x, y } = finitePairs(xIn, yIn);
  const n = y.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[j] - x[i];
      if (dx !== 0) slopes.push((y[j] - y[i]) / dx);
    }
  }
  if (!slopes.length) return { slope: NaN, intercept: NaN, ciLow: NaN, ciHigh: NaN, nSlopes: 0 };
  const sorted = Float64Array.from(slopes).sort();
  const nt = sorted.length;
  const slope = nt % 2 ? sorted[nt >> 1] : 0.5 * (sorted[(nt >> 1) - 1] + sorted[nt >> 1]);
  const intercept = median(y) - slope * median(x);
  let sigsq = n * (n - 1) * (2 * n + 5);
  for (const t of tieGroups(x)) sigsq -= t * (t - 1) * (2 * t + 5);
  for (const t of tieGroups(y)) sigsq -= t * (t - 1) * (2 * t + 5);
  sigsq /= 18;
  const z = -normPpf((1 - confidence) / 2); // positive
  const sigma = Math.sqrt(Math.max(sigsq, 0));
  const ru = Math.min(roundHalfEven((nt + z * sigma) / 2), nt - 1);
  const rl = Math.max(roundHalfEven((nt - z * sigma) / 2) - 1, 0);
  return { slope, intercept, ciLow: sorted[rl], ciHigh: sorted[ru], nSlopes: nt };
}

/**
 * Sen slope with integer index positions, NaN-aware (pymannkendall.sens_slope).
 */
export function senSlopeIndex(yIn: ArrayLike<number>): { slope: number; intercept: number } {
  const y = Array.from(yIn);
  const n = y.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (!Number.isFinite(y[i])) continue;
    for (let j = i + 1; j < n; j++) {
      if (Number.isFinite(y[j])) slopes.push((y[j] - y[i]) / (j - i));
    }
  }
  const slope = median(slopes);
  const idx: number[] = [];
  const vals: number[] = [];
  y.forEach((v, i) => {
    if (Number.isFinite(v)) {
      idx.push(i);
      vals.push(v);
    }
  });
  return { slope, intercept: median(vals) - median(idx) * slope };
}

export interface SeasonalMkResult extends MannKendallResult {
  /** Seasonal Sen slope in units per cycle (per year for monthly data). */
  slope: number;
  seasons: number;
}

/**
 * Seasonal Mann-Kendall test (Hirsch, Slack & Smith 1982): S and Var(S) are
 * summed over seasons; Z uses the continuity correction. Seasonal Sen slope
 * (Hirsch et al. 1982) = median of all within-season pairwise slopes per cycle.
 * `matrix[cycle][season]`, NaN for missing. Matches pymannkendall.seasonal_test.
 */
export function seasonalMannKendall(matrix: ArrayLike<number>[]): SeasonalMkResult {
  const seasons = matrix.length ? matrix[0].length : 0;
  let s = 0;
  let varS = 0;
  let denom = 0;
  let nTotal = 0;
  const slopes: number[] = [];
  for (let k = 0; k < seasons; k++) {
    const col: number[] = [];
    for (let r = 0; r < matrix.length; r++) col.push(matrix[r][k]);
    const valid = col.filter(Number.isFinite);
    const n = valid.length;
    s += mkScore(valid);
    varS += mkVariance(valid);
    denom += 0.5 * n * (n - 1);
    nTotal += n;
    for (let i = 0; i < col.length - 1; i++) {
      if (!Number.isFinite(col[i])) continue;
      for (let j = i + 1; j < col.length; j++) {
        if (Number.isFinite(col[j])) slopes.push((col[j] - col[i]) / (j - i));
      }
    }
  }
  const z = mkZ(s, varS);
  return {
    n: nTotal,
    s,
    varS,
    z,
    p: varS > 0 ? normTwoSidedP(z) : NaN,
    tau: denom > 0 ? s / denom : NaN,
    slope: median(slopes),
    seasons,
  };
}
