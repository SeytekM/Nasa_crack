/** Small numeric helpers. All functions ignore nothing: filter NaN first. */

export function mean(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return xs.length ? s / xs.length : NaN;
}

export function sum(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s;
}

/** Sample variance (ddof = 1). */
export function variance(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - m) ** 2;
  return s / (n - 1);
}

export function sd(xs: ArrayLike<number>): number {
  return Math.sqrt(variance(xs));
}

/** Median of a numeric array (does not mutate input). NaN for empty input. */
export function median(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (!n) return NaN;
  const a = Float64Array.from(xs).sort();
  const mid = n >> 1;
  return n % 2 ? a[mid] : 0.5 * (a[mid - 1] + a[mid]);
}

/** Round half to even (NumPy's np.round behaviour). */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) return 2 * Math.round(x / 2);
  return r;
}

export function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** Keep only pairs where both x and y are finite. */
export function finitePairs(x: ArrayLike<number>, y: ArrayLike<number>): { x: number[]; y: number[] } {
  const xo: number[] = [];
  const yo: number[] = [];
  for (let i = 0; i < y.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xo.push(x[i]);
      yo.push(y[i]);
    }
  }
  return { x: xo, y: yo };
}

/** Average ranks (ties get the mean rank), 1-based, like scipy.stats.rankdata. */
export function rankAverage(xs: ArrayLike<number>): number[] {
  const n = xs.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k]] = r;
    i = j + 1;
  }
  return ranks;
}

/** Sizes of tie groups (only groups with size > 1). */
export function tieGroups(xs: ArrayLike<number>): number[] {
  const a = Float64Array.from(xs).sort();
  const groups: number[] = [];
  let i = 0;
  while (i < a.length) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[i]) j++;
    if (j > i) groups.push(j - i + 1);
    i = j + 1;
  }
  return groups;
}
