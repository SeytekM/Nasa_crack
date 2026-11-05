/** Number formatting helpers (all user-visible numbers go through these). */

/** Decimals that keep ~2–3 significant digits without exponent notation. */
export function autoDecimals(x: number): number {
  const a = Math.abs(x);
  if (!Number.isFinite(a) || a === 0) return 2;
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 0.1) return 2;
  return Math.min(6, Math.ceil(-Math.log10(a)) + 1);
}

export function fmt(x: number, decimals = autoDecimals(x)): string {
  if (!Number.isFinite(x)) return '—';
  const s = x.toFixed(decimals);
  return s === '-0' || /^-0\.0*$/.test(s) ? s.slice(1) : s.replace('-', '−');
}

export function fmtSigned(x: number, decimals = autoDecimals(x)): string {
  if (!Number.isFinite(x)) return '—';
  const s = fmt(Math.abs(x), decimals);
  if (Number(Math.abs(x).toFixed(decimals)) === 0) return s;
  return (x > 0 ? '+' : '−') + s;
}

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return '< 0.001';
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}

/** "p < 0.001" or "p = 0.034". */
export function fmtPEq(p: number, sym = 'p'): string {
  if (!Number.isFinite(p)) return `${sym} = —`;
  return p < 0.001 ? `${sym} < 0.001` : `${sym} = ${fmtP(p)}`;
}

export function fmtCoord(x: number, pos: string, neg: string): string {
  return `${Math.abs(x).toFixed(2)}° ${x >= 0 ? pos : neg}`;
}

export function fmtLatLon(lat: number, lon: number): string {
  return `${fmtCoord(lat, 'N', 'S')}, ${fmtCoord(lon, 'E', 'W')}`;
}

export function withUnits(value: string, units: string): string {
  if (!units || units === '0–1') return value;
  if (units === '%' || units === '°C') return `${value} ${units === '%' ? '% pts' : units}`;
  return `${value} ${units}`;
}

/** Decimal year → epoch milliseconds (UTC). */
export function decimalYearToMs(t: number): number {
  const y = Math.floor(t);
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return start + (t - y) * (end - start);
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}
