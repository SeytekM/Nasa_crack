import { effectiveSampleSize } from './ols';
import { tPpf } from './special';

export interface YearsToSignificanceInput {
  /** Trend slope in units per year. */
  slopePerYear: number;
  /** Residual standard deviation around the trend line. */
  residualSd: number;
  /** Lag-1 autocorrelation of residuals (≤ 0 treated as 0). */
  r1: number;
  /** Current number of observations. */
  n: number;
  /** Spacing between observations in years (1 for annual, 1/12 for monthly). */
  stepYears: number;
  /** Time (decimal year) of the first observation. */
  firstTime: number;
  alpha?: number;
  /** Maximum number of extra years to search. */
  horizonYears?: number;
}

export interface YearsToSignificanceResult {
  /** Number of observations needed (total, including existing ones). */
  nNeeded: number;
  /** Decimal year of the last observation at which the test first passes. */
  year: number;
  /** Extra years beyond the current record. */
  extraYears: number;
}

/**
 * Smallest record length N ≥ n for which a trend of the *same* slope, with
 * the *same* residual noise and AR(1) persistence, would pass the
 * autocorrelation-adjusted two-sided t-test:
 *   SE(N) = s / sqrt(Sxx(N)) · sqrt((N − 2)/(N_eff − 2)),  Sxx(N) = Δ²·N(N²−1)/12,
 *   N_eff = N(1 − r1)/(1 + r1),  require |b| / SE(N) > t_{1−α/2, N_eff − 2}.
 * Returns null when the slope is zero or the horizon is exceeded.
 * This is a projection under strong assumptions, not a forecast.
 */
export function yearsToSignificance(inp: YearsToSignificanceInput): YearsToSignificanceResult | null {
  const { slopePerYear: b, residualSd: s, n, stepYears: dt, firstTime } = inp;
  const alpha = inp.alpha ?? 0.05;
  const horizon = inp.horizonYears ?? 150;
  if (!(Math.abs(b) > 0) || !(s > 0) || !(n >= 3)) return null;
  const r1 = Number.isFinite(inp.r1) && inp.r1 > 0 ? inp.r1 : 0;
  const maxN = n + Math.ceil(horizon / dt);
  for (let N = n; N <= maxN; N++) {
    const nEff = effectiveSampleSize(N, r1);
    const df = nEff - 2;
    if (!(df > 0)) continue;
    const sxx = (dt * dt * N * (N * N - 1)) / 12;
    const se = (s / Math.sqrt(sxx)) * Math.sqrt((N - 2) / df);
    const tc = tPpf(1 - alpha / 2, df);
    if (Math.abs(b) / se > tc) {
      const year = firstTime + (N - 1) * dt;
      return { nNeeded: N, year, extraYears: (N - n) * dt };
    }
  }
  return null;
}
