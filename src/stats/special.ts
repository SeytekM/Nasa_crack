/**
 * Special functions needed for p-values and confidence intervals.
 * Pure TypeScript, no dependencies. Accuracy target: ~1e-12 relative in the
 * ranges used by the app (validated against SciPy fixtures).
 */

const LANCZOS_G = 7;
const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/** Natural log of the Gamma function (Lanczos approximation, x > 0). */
export function lnGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS_COEF[0];
  const t = z + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) a += LANCZOS_COEF[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

const EPS = 1e-16;
const FPMIN = 1e-300;

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function betaInc(a: number, b: number, x: number): number {
  if (!(a > 0) || !(b > 0)) return NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  const front = Math.exp(lnFront);
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(a, b, x)) / a;
  return 1 - (front * betacf(b, a, 1 - x)) / b;
}

/**
 * Upper tail probability of Student's t: P(T > t) for df > 0 (df may be
 * non-integer, e.g. an effective sample size − 2).
 */
export function tSf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 0 : 1;
  if (!(df > 0)) return NaN;
  const x = df / (df + t * t);
  const tail = 0.5 * betaInc(df / 2, 0.5, x);
  return t > 0 ? tail : 1 - tail;
}

/** CDF of Student's t. */
export function tCdf(t: number, df: number): number {
  return 1 - tSf(t, df);
}

/** Two-sided p-value for a t statistic. */
export function tTwoSidedP(t: number, df: number): number {
  if (!(df > 0) || Number.isNaN(t)) return NaN;
  const x = df / (df + t * t);
  return Math.min(1, betaInc(df / 2, 0.5, x));
}

/** Inverse CDF (quantile) of Student's t. */
export function tPpf(p: number, df: number): number {
  if (!(p > 0 && p < 1) || !(df > 0)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return NaN;
  }
  if (p === 0.5) return 0;
  // Work in the upper half and use symmetry.
  const upper = p > 0.5;
  const q = upper ? 1 - p : p; // lower-tail probability, q < 0.5
  // Initial guess from normal quantile, with Cornish-Fisher style correction.
  const z = -normPpf(q); // z > 0
  const g1 = (z ** 3 + z) / 4;
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
  let t = z + g1 / df + g2 / (df * df);
  if (!Number.isFinite(t) || t <= 0) t = z;
  // Bracket for safeguarded Newton.
  let lo = 0;
  let hi = Math.max(2 * t, 1);
  while (tSf(hi, df) > q) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const f = tSf(t, df) - q; // decreasing in t
    if (f > 0) lo = t;
    else hi = t;
    const dens = tPdf(t, df);
    let next = t + f / dens;
    if (!(next > lo && next < hi) || !Number.isFinite(next)) next = 0.5 * (lo + hi);
    if (Math.abs(next - t) <= 1e-14 * Math.max(1, Math.abs(t))) {
      t = next;
      break;
    }
    t = next;
  }
  return upper ? t : -t;
}

/** Density of Student's t. */
export function tPdf(t: number, df: number): number {
  const lnC = lnGamma((df + 1) / 2) - lnGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(lnC - ((df + 1) / 2) * Math.log1p((t * t) / df));
}

/** Regularized lower incomplete gamma P(a, x) and upper Q(a, x). */
function gammaPQ(a: number, x: number): { p: number; q: number } {
  if (x <= 0) return { p: 0, q: 1 };
  const gln = lnGamma(a);
  if (x < a + 1) {
    // Series representation
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 10000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    const p = sum * Math.exp(-x + a * Math.log(x) - gln);
    return { p, q: 1 - p };
  }
  // Continued fraction (Lentz)
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - gln) * h;
  return { p: 1 - q, q };
}

/** Complementary error function. */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x >= 0) return gammaPQ(0.5, x * x).q;
  return 1 + gammaPQ(0.5, x * x).p;
}

/** Standard normal CDF. */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Standard normal upper tail P(Z > z), accurate for large z. */
export function normSf(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

/** Two-sided p-value for a standard normal statistic. */
export function normTwoSidedP(z: number): number {
  return Math.min(1, 2 * normSf(Math.abs(z)));
}

/** Inverse standard normal CDF (Acklam's algorithm + one Halley refinement). */
export function normPpf(p: number): number {
  if (p <= 0) return p === 0 ? -Infinity : NaN;
  if (p >= 1) return p === 1 ? Infinity : NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  let x: number;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Halley refinement
  for (let i = 0; i < 2; i++) {
    const e = normCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    x = x - u / (1 + (x * u) / 2);
  }
  return x;
}
