import { finitePairs } from './descriptive';

export interface StepCheckResult {
  /** x of the first observation after the break. */
  breakX: number;
  /** Mean after − mean before. */
  stepSize: number;
  sseLinear: number;
  sseStep: number;
  /** BIC(linear) − BIC(step): > 10 is very strong evidence for a step. */
  deltaBic: number;
  /** True when a single abrupt jump explains the data much better than a steady trend. */
  flagged: boolean;
}

/**
 * Does the series look more like one abrupt jump than a steady trend?
 * Compares a linear model (2 parameters) with a two-segment mean model
 * (2 means + break position = 3 parameters) using the Bayesian Information
 * Criterion. Abrupt jumps often come from changes in instruments or data
 * sources (e.g. SRB → CERES in 2001), so this is a homogeneity warning, not
 * proof. Each segment must hold ≥ max(3, 15 % of n) points.
 */
export function stepChangeCheck(xIn: ArrayLike<number>, yIn: ArrayLike<number>, threshold = 10): StepCheckResult | null {
  const { x, y } = finitePairs(xIn, yIn);
  const n = y.length;
  if (n < 10) return null;
  // Linear SSE
  const xm = x.reduce((a, b) => a + b, 0) / n;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - xm) ** 2;
    sxy += (x[i] - xm) * (y[i] - ym);
    syy += (y[i] - ym) ** 2;
  }
  const sseLinear = Math.max(syy - (sxy * sxy) / sxx, 0);
  // Best single step via prefix sums
  const minSeg = Math.max(3, Math.ceil(0.15 * n));
  const ps = [0];
  const ps2 = [0];
  for (let i = 0; i < n; i++) {
    ps.push(ps[i] + y[i]);
    ps2.push(ps2[i] + y[i] * y[i]);
  }
  let best = { k: -1, sse: Infinity };
  for (let k = minSeg; k <= n - minSeg; k++) {
    const s1 = ps[k];
    const s2 = ps[n] - ps[k];
    const sse = ps2[k] - (s1 * s1) / k + (ps2[n] - ps2[k] - (s2 * s2) / (n - k));
    if (sse < best.sse) best = { k, sse };
  }
  if (best.k < 0) return null;
  const sseStep = Math.max(best.sse, 0);
  const eps = 1e-12 * (syy + 1e-300);
  const bic = (sse: number, k: number) => n * Math.log(Math.max(sse, eps) / n) + k * Math.log(n);
  const deltaBic = bic(sseLinear, 2) - bic(sseStep, 3);
  const m1 = ps[best.k] / best.k;
  const m2 = (ps[n] - ps[best.k]) / (n - best.k);
  return {
    breakX: x[best.k],
    stepSize: m2 - m1,
    sseLinear,
    sseStep,
    deltaBic,
    flagged: syy > 0 && deltaBic > threshold,
  };
}
