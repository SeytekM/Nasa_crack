/**
 * Tolerant CSV time-series parser for "Bring your own data" (e.g. NASA
 * Giovanni "Time Series, Area-Averaged" exports). Skips metadata/comment
 * lines, detects the date and value columns, removes fill values and
 * averages sub-monthly data to monthly means.
 */
import type { MonthlyRecord } from '../stats/series';

export type Resolution = 'daily' | 'monthly' | 'annual';

export interface ParsedSeries {
  records: MonthlyRecord[];
  name: string;
  units: string;
  resolution: Resolution;
  dateColumn: string;
  valueColumn: string;
  rowsUsed: number;
  rowsSkipped: number;
  fillValues: number[];
  start: number;
  end: number;
}

export class CsvParseError extends Error {}

const DEFAULT_FILLS = [-9999, -999, -99999, -9999.9, -999.9, -32768, -1e30, 9.96921e36];
const MISSING = new Set(['', 'nan', 'na', 'n/a', 'null', 'none', '-', '--']);

interface DateParts {
  year: number;
  month?: number;
  day?: number;
}

/** Parse a date cell; returns null when it does not look like a date. */
export function parseDateCell(raw: string): DateParts | null {
  const s = raw.trim().replace(/^"|"$/g, '');
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[T\s].*)?$/);
  if (m) return valid({ year: +m[1], month: +m[2], day: m[3] ? +m[3] : undefined });
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return valid({ year: +m[1], month: +m[2], day: +m[3] });
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) return valid({ year: +m[1], month: +m[2] });
  m = s.match(/^(\d{4})$/);
  if (m) return valid({ year: +m[1] });
  return null;
}

function valid(d: DateParts): DateParts | null {
  if (d.year < 1800 || d.year > 2200) return null;
  if (d.month !== undefined && (d.month < 1 || d.month > 12)) return null;
  if (d.day !== undefined && (d.day < 1 || d.day > 31)) return null;
  return d;
}

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/^"|"$/g, '');
  if (MISSING.has(s.toLowerCase())) return NaN;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  return Number(s);
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === delim && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(-50);
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = sample.map((l) => splitLine(l, d).length);
    const mode = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)] ?? 1;
    if (mode > 1 && mode > bestScore) {
      best = d;
      bestScore = mode;
    }
  }
  if (bestScore < 0 && lines.some((l) => /\S\s+\S/.test(l))) return 'ws';
  return best;
}

export function parseCsvSeries(text: string, fileName = 'data.csv'): ParsedSeries {
  const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const lines = rawLines.filter((l) => l.trim() !== '' && !/^\s*(#|\/\/|%)/.test(l));
  if (!lines.length) throw new CsvParseError('The file is empty.');
  const delim = detectDelimiter(lines);
  const split = (l: string) => (delim === 'ws' ? l.trim().split(/\s+/) : splitLine(l, delim));
  const rows = lines.map(split);

  // Fill values declared in metadata lines, e.g. "Fill Value (mean_x):,-9999.0"
  const fills = new Set(DEFAULT_FILLS);
  for (const l of rawLines) {
    const m = l.match(/fill[\s_-]*value[^,;\t:]*[:]?[\s,;\t]+(-?[\d.]+(?:[eE][-+]?\d+)?)/i);
    if (m) fills.add(Number(m[1]));
  }

  // Data row = has a date cell and at least one numeric (or missing) cell elsewhere.
  const isData = (r: string[]) => {
    const di = r.findIndex((c) => parseDateCell(c) !== null);
    if (di < 0) return false;
    return r.some((c, j) => j !== di && parseNumber(c) !== null);
  };
  let first = -1;
  for (let i = 0; i < rows.length; i++) {
    if (isData(rows[i]) && rows.slice(i, i + 3).every(isData)) {
      first = i;
      break;
    }
  }
  if (first < 0) throw new CsvParseError('Could not find rows with a date and a number. Expected e.g. “2001-01-01, 0.25”.');
  const data = rows.slice(first).filter((r) => isData(r));
  const width = Math.max(...data.map((r) => r.length));
  const header = first > 0 && rows[first - 1].length >= Math.min(width, 2) ? rows[first - 1] : [];

  // Date column: most cells parse as dates. Value column: most numeric (non-date) cells.
  const score = (fn: (c: string) => boolean) => Array.from({ length: width }, (_, j) => data.filter((r) => r[j] !== undefined && fn(r[j])).length);
  const dateScores = score((c) => parseDateCell(c) !== null);
  const dateCol = dateScores.indexOf(Math.max(...dateScores));
  const numScores = score((c) => parseNumber(c) !== null).map((v, j) => (j === dateCol ? -1 : v));
  let valueCol = numScores.indexOf(Math.max(...numScores));
  const meanCol = header.findIndex((h, j) => j !== dateCol && /mean|avg|value/i.test(h) && numScores[j] > 0.8 * numScores[valueCol]);
  if (meanCol >= 0) valueCol = meanCol;
  if (valueCol < 0 || numScores[valueCol] <= 0) throw new CsvParseError('No numeric value column found.');

  // Collect values
  const buckets = new Map<string, { y: number; m: number; s: number; n: number }>();
  let used = 0;
  let skipped = rows.length - data.length;
  let hasDay = false;
  let hasMonth = false;
  for (const r of data) {
    const d = parseDateCell(r[dateCol] ?? '');
    const v = parseNumber(r[valueCol] ?? '');
    if (!d || v === null || !Number.isFinite(v) || fills.has(v) || Math.abs(v) >= 1e19) {
      skipped++;
      continue;
    }
    if (d.day !== undefined) hasDay = true;
    if (d.month !== undefined) hasMonth = true;
    const months = d.month !== undefined ? [d.month] : Array.from({ length: 12 }, (_, i) => i + 1);
    for (const m of months) {
      const k = `${d.year}-${m}`;
      const b = buckets.get(k) ?? { y: d.year, m, s: 0, n: 0 };
      b.s += v;
      b.n++;
      buckets.set(k, b);
    }
    used++;
  }
  if (used < 3) throw new CsvParseError('Fewer than 3 usable values after removing fill values.');
  const years = [...buckets.values()].map((b) => b.y);
  const start = Math.min(...years);
  const end = Math.max(...years);
  const records: MonthlyRecord[] = [];
  for (let y = start; y <= end; y++) {
    for (let m = 1; m <= 12; m++) {
      const b = buckets.get(`${y}-${m}`);
      records.push({ year: y, month: m, value: b ? b.s / b.n : NaN });
    }
  }
  const resolution: Resolution = !hasMonth ? 'annual' : hasDay && data.length > (end - start + 1) * 12 * 1.5 ? 'daily' : 'monthly';
  const valueName = header[valueCol] || `column ${valueCol + 1}`;
  const unitMatch = valueName.match(/\(([^)]+)\)|\[([^\]]+)\]/);
  return {
    records,
    name: valueName.replace(/^mean_/i, '').replace(/_/g, ' ').slice(0, 80) || fileName,
    units: unitMatch ? (unitMatch[1] ?? unitMatch[2]) : '',
    resolution,
    dateColumn: header[dateCol] || `column ${dateCol + 1}`,
    valueColumn: valueName,
    rowsUsed: used,
    rowsSkipped: skipped,
    fillValues: [...fills].filter((f) => !DEFAULT_FILLS.includes(f)),
    start,
    end,
  };
}
