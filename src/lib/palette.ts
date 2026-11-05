/**
 * Colour-blind-safe diverging palettes (ColorBrewer 9-class RdBu, BrBG, PuOr),
 * ordered negative → positive. See docs/DESIGN.md.
 */
import { CATALOG, type PaletteFamily, type VarCode } from '../data/catalog';

export const DIVERGING: Record<PaletteFamily, string[]> = {
  // blue (cooling) → red (warming)
  temperature: ['#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7', '#fddbc7', '#f4a582', '#d6604d', '#b2182b'],
  // brown (drier) → teal (wetter)
  moisture: ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e'],
  // orange → purple
  neutral: ['#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788'],
};

/** Variables where a positive slope means "colder" (drawn with the cool pole). */
const INVERTED: Partial<Record<VarCode, boolean>> = { FROST_DAYS: true };

export function familyOf(code: string): PaletteFamily {
  return (CATALOG as Record<string, { palette: PaletteFamily }>)[code]?.palette ?? 'neutral';
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Continuous colour for a value on a symmetric scale [−max, +max]. */
export function divergingColor(value: number, max: number, code: string): string {
  const stops = DIVERGING[familyOf(code)];
  if (!Number.isFinite(value) || !(max > 0)) return stops[4];
  let v = Math.max(-1, Math.min(1, value / max));
  if (INVERTED[code as VarCode]) v = -v;
  const pos = ((v + 1) / 2) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  return mix(stops[i], stops[i + 1], pos - i);
}

/** Pole colour for a sign (used for arrows / chips). */
export function directionColor(sign: number, code: string): string {
  const stops = DIVERGING[familyOf(code)];
  const s = INVERTED[code as VarCode] ? -sign : sign;
  return s > 0 ? stops[7] : s < 0 ? stops[1] : stops[4];
}
