/**
 * Multiple-comparison control.
 */

/**
 * Benjamini–Hochberg adjusted p-values ("q-values"):
 *   q_(i) = min_{k ≥ i} ( p_(k) · m / k ), capped at 1.
 * Non-finite p-values are ignored (their q is NaN) and do not count in m.
 * Matches scipy.stats.false_discovery_control(ps, method='bh').
 */
export function benjaminiHochberg(ps: ArrayLike<number>): number[] {
  const idx: number[] = [];
  for (let i = 0; i < ps.length; i++) if (Number.isFinite(ps[i])) idx.push(i);
  const m = idx.length;
  const out = new Array<number>(ps.length).fill(NaN);
  if (!m) return out;
  idx.sort((a, b) => ps[a] - ps[b]);
  let running = Infinity;
  for (let r = m - 1; r >= 0; r--) {
    const i = idx[r];
    const q = (ps[i] * m) / (r + 1);
    running = Math.min(running, q);
    out[i] = Math.min(1, running);
  }
  return out;
}

export interface WilksFdrResult {
  /** p-value threshold; local tests with p ≤ threshold are significant. 0 if none. */
  threshold: number;
  significant: boolean[];
  nSignificant: number;
  nTests: number;
  alphaFdr: number;
}

/**
 * False Discovery Rate control for gridded fields (Wilks 2016, BAMS 97:2263):
 *   p_FDR = max { p_(i) : p_(i) ≤ (i/N)·α_FDR }
 * Wilks recommends α_FDR = 2·α_global (0.10 for a 5% global test) to account
 * for spatial correlation.
 */
export function wilksFdr(ps: ArrayLike<number>, alphaFdr = 0.1): WilksFdrResult {
  const finite: number[] = [];
  for (let i = 0; i < ps.length; i++) if (Number.isFinite(ps[i])) finite.push(ps[i]);
  const sorted = finite.sort((a, b) => a - b);
  const N = sorted.length;
  let threshold = 0;
  for (let i = 0; i < N; i++) {
    if (sorted[i] <= ((i + 1) / N) * alphaFdr) threshold = sorted[i];
  }
  const significant: boolean[] = [];
  let nSignificant = 0;
  for (let i = 0; i < ps.length; i++) {
    const sig = Number.isFinite(ps[i]) && threshold > 0 && ps[i] <= threshold;
    significant.push(sig);
    if (sig) nSignificant++;
  }
  return { threshold, significant, nSignificant, nTests: N, alphaFdr };
}
