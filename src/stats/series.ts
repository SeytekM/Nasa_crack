/**
 * Time-series preprocessing for monthly climate records.
 * A record with value NaN is a missing month.
 */

export interface MonthlyRecord {
  year: number;
  /** 1–12 */
  month: number;
  value: number;
}

export interface AnnualRecord {
  year: number;
  value: number;
  /** Number of valid months used. */
  months: number;
}

/**
 * How monthly values combine into a yearly value.
 * - `mean`: day-weighted mean (e.g. °C, %, m/s)
 * - `sum`: plain sum of monthly values (e.g. frost days per month → days/yr)
 * - `rateSum`: Σ value × days-in-month (e.g. mm/day → mm/yr)
 */
export type AnnualAggregation = 'mean' | 'sum' | 'rateSum';

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Mid-month decimal year, e.g. 1981-01 → 1981.0417. */
export function decimalTime(year: number, month: number): number {
  return year + (month - 0.5) / 12;
}

/**
 * Parse POWER's `{ "YYYYMM": value }` object. Drops month 13 (annual value),
 * turns the fill value and out-of-range values into NaN, returns records
 * sorted in time.
 */
export function parseYyyymm(
  obj: Record<string, number | null>,
  opts: { fill?: number; validRange?: [number, number] } = {},
): MonthlyRecord[] {
  const fill = opts.fill ?? -999;
  const out: MonthlyRecord[] = [];
  for (const [key, raw] of Object.entries(obj)) {
    if (!/^\d{6}$/.test(key)) continue;
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4));
    if (month < 1 || month > 12) continue;
    let value = typeof raw === 'number' ? raw : NaN;
    if (value === fill || !Number.isFinite(value)) value = NaN;
    if (opts.validRange && (value < opts.validRange[0] || value > opts.validRange[1])) value = NaN;
    out.push({ year, month, value });
  }
  out.sort((a, b) => a.year - b.year || a.month - b.month);
  return out;
}

/** Keep records with start ≤ year ≤ end. */
export function sliceYears<T extends { year: number }>(recs: T[], start: number, end: number): T[] {
  return recs.filter((r) => r.year >= start && r.year <= end);
}

/** Drop leading and trailing missing months. */
export function trimMissing(recs: MonthlyRecord[]): MonthlyRecord[] {
  let a = 0;
  let b = recs.length - 1;
  while (a <= b && !Number.isFinite(recs[a].value)) a++;
  while (b >= a && !Number.isFinite(recs[b].value)) b--;
  return recs.slice(a, b + 1);
}

/** Mean of each calendar month over the given records (NaN-aware). Index 0 = January. */
export function monthlyClimatology(recs: MonthlyRecord[]): number[] {
  const s = new Array<number>(12).fill(0);
  const c = new Array<number>(12).fill(0);
  for (const r of recs) {
    if (Number.isFinite(r.value)) {
      s[r.month - 1] += r.value;
      c[r.month - 1]++;
    }
  }
  return s.map((v, i) => (c[i] ? v / c[i] : NaN));
}

/** Monthly anomalies: value − climatological mean of that calendar month. */
export function monthlyAnomalies(recs: MonthlyRecord[], clim = monthlyClimatology(recs)): MonthlyRecord[] {
  return recs.map((r) => ({ ...r, value: r.value - clim[r.month - 1] }));
}

/**
 * Annual aggregates. A year is kept only if it has at least `minMonths`
 * valid months (default 12 — incomplete years would bias sums and means).
 */
export function annualAggregate(recs: MonthlyRecord[], agg: AnnualAggregation, minMonths = 12): AnnualRecord[] {
  const byYear = new Map<number, MonthlyRecord[]>();
  for (const r of recs) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year)!.push(r);
  }
  const out: AnnualRecord[] = [];
  for (const [year, rs] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const valid = rs.filter((r) => Number.isFinite(r.value));
    if (valid.length < minMonths) {
      out.push({ year, value: NaN, months: valid.length });
      continue;
    }
    let value: number;
    if (agg === 'sum') {
      value = valid.reduce((a, r) => a + r.value, 0);
    } else if (agg === 'rateSum') {
      value = valid.reduce((a, r) => a + r.value * daysInMonth(r.year, r.month), 0);
    } else {
      let w = 0;
      let s = 0;
      for (const r of valid) {
        const d = daysInMonth(r.year, r.month);
        s += r.value * d;
        w += d;
      }
      value = s / w;
    }
    out.push({ year, value, months: valid.length });
  }
  return out;
}

/**
 * Centred 2×12 moving average (weights 1/24, 1/12 ×11, 1/24), the classical
 * filter that removes a 12-month seasonal cycle. NaN when any input is missing.
 */
export function centeredMovingAverage12(values: ArrayLike<number>): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(NaN);
  for (let i = 6; i < n - 6; i++) {
    let s = 0.5 * values[i - 6] + 0.5 * values[i + 6];
    for (let k = -5; k <= 5; k++) s += values[i + k];
    out[i] = s / 12;
  }
  return out;
}

/**
 * Convert monthly records (assumed contiguous, starting in any month) into a
 * [year][month] matrix for the seasonal Mann-Kendall test.
 */
export function toSeasonMatrix(recs: MonthlyRecord[]): number[][] {
  if (!recs.length) return [];
  const y0 = recs[0].year;
  const y1 = recs[recs.length - 1].year;
  const m: number[][] = [];
  for (let y = y0; y <= y1; y++) m.push(new Array<number>(12).fill(NaN));
  for (const r of recs) m[r.year - y0][r.month - 1] = r.value;
  return m;
}
