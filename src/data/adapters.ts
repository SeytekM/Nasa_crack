import { CATALOG, type VarCode } from './catalog';
import type { PointDataset, RegionalDataset } from './types';
import type { MonthlyRecord } from '../stats/series';

/** Monthly records for one variable; out-of-range values become NaN. */
export function recordsFromArray(values: (number | null)[], start: number, validRange?: [number, number]): MonthlyRecord[] {
  return values.map((v, i) => {
    let value = v ?? NaN;
    if (validRange && (value < validRange[0] || value > validRange[1])) value = NaN;
    return { year: start + Math.floor(i / 12), month: (i % 12) + 1, value };
  });
}

export function pointRecords(d: PointDataset, code: VarCode): MonthlyRecord[] {
  const vals = d.params[code];
  if (!vals) return [];
  return recordsFromArray(vals, d.start, CATALOG[code].validRange);
}

export function regionalCellRecords(d: RegionalDataset, cellIndex: number): MonthlyRecord[] {
  const vals = d.values[cellIndex];
  if (!vals) return [];
  const meta = (CATALOG as Record<string, { validRange: [number, number] }>)[d.param];
  return recordsFromArray(vals, d.start, meta?.validRange);
}

/** Cell index → centre coordinates and half-sizes (for drawing). */
export function regionalCellGeometry(d: RegionalDataset, idx: number) {
  const i = Math.floor(idx / d.lons.length);
  const j = idx % d.lons.length;
  const dLat = d.lats.length > 1 ? d.lats[1] - d.lats[0] : 0.5;
  const dLon = d.lons.length > 1 ? d.lons[1] - d.lons[0] : 0.625;
  return { lat: d.lats[i], lon: d.lons[j], halfLat: dLat / 2, halfLon: dLon / 2 };
}
