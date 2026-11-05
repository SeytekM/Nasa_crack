import { finitePairs } from './descriptive';
import { tPpf, tTwoSidedP } from './special';

export interface OlsFit {
  n: number;
  slope: number;
  intercept: number;
  /** Standard error of the slope. */
  se: number;
  interceptSe: number;
  t: number;
  df: number;
  /** Two-sided p-value. */
  p: number;
  ciLow: number;
  ciHigh: number;
  r: number;
  r2: number;
  /** Residual standard deviation, sqrt(SSE / (n − 2)). */
  residualSd: number;
  residuals: number[];
  x: number[];
  y: number[];
  xMean: number;
  sxx: number;
}

/**
 * Ordinary least squares y = a + b·x. Non-finite pairs are dropped.
 * Matches scipy.stats.linregress (slope, intercept, rvalue, pvalue, stderr,
 * intercept_stderr).
 */
export function ols(xIn: ArrayLike<number>, yIn: ArrayLike<number>, confidence = 0.95): OlsFit {
  const { x, y } = finitePairs(xIn, yIn);
  const n = x.length;
  let xm = 0;
  let ym = 0;
  for (let i = 0; i < n; i++) {
    xm += x[i];
    ym += y[i];
  }
  xm /= n;
  ym /= n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xm;
    const dy = y[i] - ym;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxy / sxx;
  const intercept = ym - slope * xm;
  const residuals = x.map((xi, i) => y[i] - (intercept + slope * xi));
  let sse = 0;
  for (const e of residuals) sse += e * e;
  const df = n - 2;
  const s2 = sse / df;
  const se = Math.sqrt(s2 / sxx);
  const interceptSe = Math.sqrt(s2 * (1 / n + (xm * xm) / sxx));
  const r = syy === 0 || sxx === 0 ? 0 : Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  const t = se === 0 ? (slope === 0 ? 0 : Math.sign(slope) * Infinity) : slope / se;
  const p = df > 0 ? (se === 0 ? (slope === 0 ? 1 : 0) : tTwoSidedP(t, df)) : NaN;
  const tc = df > 0 ? tPpf(0.5 + confidence / 2, df) : NaN;
  return {
    n,
    slope,
    intercept,
    se,
    interceptSe,
    t,
    df,
    p,
    ciLow: slope - tc * se,
    ciHigh: slope + tc * se,
    r,
    r2: r * r,
    residualSd: Math.sqrt(s2),
    residuals,
    x,
    y,
    xMean: xm,
    sxx,
  };
}

/**
 * Lag-1 autocorrelation of residuals (Santer et al. 2000):
 *   r1 = Σ e_t·e_{t+1} / Σ e_t²
 * Only consecutive pairs exactly one `step` apart contribute to the numerator,
 * so gaps in the record do not create spurious pairs.
 */
export function lag1Autocorrelation(residuals: ArrayLike<number>, x?: ArrayLike<number>, step?: number): number {
  const n = residuals.length;
  if (n < 3) return NaN;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) den += residuals[i] * residuals[i];
  for (let i = 0; i < n - 1; i++) {
    if (x && step !== undefined && Math.abs(x[i + 1] - x[i] - step) > step * 1e-6) continue;
    num += residuals[i] * residuals[i + 1];
  }
  return den === 0 ? 0 : num / den;
}

export interface Ar1AdjustedFit {
  r1: number;
  /** Effective sample size n·(1 − r1)/(1 + r1), capped at n when r1 ≤ 0. */
  nEff: number;
  se: number;
  df: number;
  t: number;
  p: number;
  ciLow: number;
  ciHigh: number;
  /** Multiplier applied to the OLS variance: (n − 2)/(nEff − 2). */
  varianceInflation: number;
  /** True when nEff ≤ 2 and no valid test is possible. */
  degenerate: boolean;
}

/** Effective sample size for AR(1) residuals; never larger than n. */
export function effectiveSampleSize(n: number, r1: number): number {
  if (!Number.isFinite(r1) || r1 <= 0) return n;
  if (r1 >= 1) return 0;
  return (n * (1 - r1)) / (1 + r1);
}

/**
 * Autocorrelation-adjusted trend test (Santer et al. 2000, eqs. 3–6):
 * SE is inflated by sqrt((n−2)/(nEff−2)) and the t-test uses nEff − 2
 * degrees of freedom.
 */
export function ar1Adjust(fit: OlsFit, step?: number, confidence = 0.95): Ar1AdjustedFit {
  const r1 = lag1Autocorrelation(fit.residuals, fit.x, step);
  const nEff = effectiveSampleSize(fit.n, r1);
  const df = nEff - 2;
  if (!(df > 0)) {
    return { r1, nEff, se: NaN, df, t: NaN, p: NaN, ciLow: NaN, ciHigh: NaN, varianceInflation: Infinity, degenerate: true };
  }
  const varianceInflation = (fit.n - 2) / df;
  const se = fit.se * Math.sqrt(varianceInflation);
  const t = se === 0 ? (fit.slope === 0 ? 0 : Math.sign(fit.slope) * Infinity) : fit.slope / se;
  const p = se === 0 ? (fit.slope === 0 ? 1 : 0) : tTwoSidedP(t, df);
  const tc = tPpf(0.5 + confidence / 2, df);
  return { r1, nEff, se, df, t, p, ciLow: fit.slope - tc * se, ciHigh: fit.slope + tc * se, varianceInflation, degenerate: false };
}

/**
 * Confidence band for the fitted mean line at positions xs:
 *   ŷ ± t_crit · s · sqrt(varianceInflation) · sqrt(1/n + (x − x̄)²/Sxx)
 * With varianceInflation = 1 and df = n − 2 this is the classical OLS band.
 */
export function regressionBand(
  fit: OlsFit,
  xs: ArrayLike<number>,
  opts: { varianceInflation?: number; df?: number; confidence?: number } = {},
): { x: number[]; fit: number[]; low: number[]; high: number[] } {
  const infl = opts.varianceInflation ?? 1;
  const df = opts.df ?? fit.df;
  const tc = tPpf(0.5 + (opts.confidence ?? 0.95) / 2, df);
  const s = fit.residualSd * Math.sqrt(infl);
  const out = { x: [] as number[], fit: [] as number[], low: [] as number[], high: [] as number[] };
  for (let i = 0; i < xs.length; i++) {
    const xi = xs[i];
    const yhat = fit.intercept + fit.slope * xi;
    const half = tc * s * Math.sqrt(1 / fit.n + (xi - fit.xMean) ** 2 / fit.sxx);
    out.x.push(xi);
    out.fit.push(yhat);
    out.low.push(yhat - half);
    out.high.push(yhat + half);
  }
  return out;
}
