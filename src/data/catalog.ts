/**
 * Variable catalog. Every entry was verified against the POWER monthly API
 * (community=AG) on 2026-11-05 — see docs/DATA_NOTES.md §4.
 * Human-readable texts live in the i18n dictionary (src/content/i18n).
 */
import type { AnnualAggregation } from '../stats/series';

export type Theme = 'heat' | 'water' | 'snow' | 'sun' | 'wind';
export const THEMES: Theme[] = ['heat', 'water', 'snow', 'sun', 'wind'];

/** How the value is produced — drives the honest "source" label. */
export type SourceKind =
  | 'merra2' // MERRA-2 reanalysis field
  | 'merra2-derived' // computed by POWER from hourly MERRA-2
  | 'srb-ceres'; // satellite-derived radiation (GEWEX SRB → CERES SYN1deg)

/** Diverging palette family used for trend colours. */
export type PaletteFamily = 'temperature' | 'moisture' | 'neutral';

export const VAR_CODES = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'T2M_RANGE',
  'TS',
  'T2MDEW',
  'FROST_DAYS',
  'PRECTOTCORR',
  'RH2M',
  'QV2M',
  'GWETTOP',
  'GWETROOT',
  'GWETPROF',
  'SNODP',
  'ALLSKY_SFC_SW_DWN',
  'CLRSKY_SFC_SW_DWN',
  'CLOUD_AMT',
  'WS2M',
  'WS10M',
] as const;
export type VarCode = (typeof VAR_CODES)[number];

export interface VariableMeta {
  code: VarCode;
  themes: Theme[];
  source: SourceKind;
  /** Units of the monthly values as returned by POWER. */
  units: string;
  /** Units of the annual aggregate (what trends are reported in). */
  annualUnits: string;
  agg: AnnualAggregation;
  /** Physically plausible range for monthly values; outside → treated as missing. */
  validRange: [number, number];
  /** First year with valid data. */
  firstYear: number;
  /** First year of a homogeneous record (after a known source change). */
  homogeneousFrom?: number;
  palette: PaletteFamily;
  /** Decimals for display of values. */
  decimals: number;
}

const T: Pick<VariableMeta, 'units' | 'annualUnits' | 'agg' | 'validRange' | 'firstYear' | 'palette' | 'decimals'> = {
  units: '°C',
  annualUnits: '°C',
  agg: 'mean',
  validRange: [-95, 75],
  firstYear: 1981,
  palette: 'temperature',
  decimals: 2,
};

export const CATALOG: Record<VarCode, VariableMeta> = {
  T2M: { code: 'T2M', themes: ['heat'], source: 'merra2', ...T },
  T2M_MAX: { code: 'T2M_MAX', themes: ['heat'], source: 'merra2-derived', ...T },
  T2M_MIN: { code: 'T2M_MIN', themes: ['heat', 'snow'], source: 'merra2-derived', ...T },
  T2M_RANGE: { code: 'T2M_RANGE', themes: ['heat'], source: 'merra2-derived', ...T, validRange: [0, 80] },
  TS: { code: 'TS', themes: ['heat'], source: 'merra2', ...T },
  T2MDEW: { code: 'T2MDEW', themes: ['water', 'heat'], source: 'merra2', ...T },
  FROST_DAYS: {
    code: 'FROST_DAYS',
    themes: ['snow', 'heat'],
    source: 'merra2-derived',
    units: 'days',
    annualUnits: 'days/yr',
    agg: 'sum',
    validRange: [0, 31],
    firstYear: 1981,
    palette: 'temperature',
    decimals: 1,
  },
  PRECTOTCORR: {
    code: 'PRECTOTCORR',
    themes: ['water'],
    source: 'merra2',
    units: 'mm/day',
    annualUnits: 'mm/yr',
    agg: 'rateSum',
    validRange: [0, 400],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 1,
  },
  RH2M: {
    code: 'RH2M',
    themes: ['water', 'wind'],
    source: 'merra2-derived',
    units: '%',
    annualUnits: '%',
    agg: 'mean',
    validRange: [0, 100],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 1,
  },
  QV2M: {
    code: 'QV2M',
    themes: ['water', 'wind'],
    source: 'merra2',
    units: 'g/kg',
    annualUnits: 'g/kg',
    agg: 'mean',
    validRange: [0, 50],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 2,
  },
  GWETTOP: {
    code: 'GWETTOP',
    themes: ['water'],
    source: 'merra2',
    units: '0–1',
    annualUnits: '0–1',
    agg: 'mean',
    validRange: [0, 1],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 3,
  },
  GWETROOT: {
    code: 'GWETROOT',
    themes: ['water'],
    source: 'merra2',
    units: '0–1',
    annualUnits: '0–1',
    agg: 'mean',
    validRange: [0, 1],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 3,
  },
  GWETPROF: {
    code: 'GWETPROF',
    themes: ['water'],
    source: 'merra2',
    units: '0–1',
    annualUnits: '0–1',
    agg: 'mean',
    validRange: [0, 1],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 3,
  },
  SNODP: {
    code: 'SNODP',
    themes: ['snow', 'water'],
    source: 'merra2',
    units: 'cm',
    annualUnits: 'cm',
    agg: 'mean',
    validRange: [0, 10000],
    firstYear: 1981,
    palette: 'moisture',
    decimals: 2,
  },
  ALLSKY_SFC_SW_DWN: {
    code: 'ALLSKY_SFC_SW_DWN',
    themes: ['sun'],
    source: 'srb-ceres',
    units: 'MJ/m²/day',
    annualUnits: 'MJ/m²/day',
    agg: 'mean',
    validRange: [0, 50],
    firstYear: 1984,
    homogeneousFrom: 2001,
    palette: 'neutral',
    decimals: 2,
  },
  CLRSKY_SFC_SW_DWN: {
    code: 'CLRSKY_SFC_SW_DWN',
    themes: ['sun'],
    source: 'srb-ceres',
    units: 'MJ/m²/day',
    annualUnits: 'MJ/m²/day',
    agg: 'mean',
    validRange: [0, 50],
    firstYear: 1984,
    homogeneousFrom: 2001,
    palette: 'neutral',
    decimals: 2,
  },
  CLOUD_AMT: {
    code: 'CLOUD_AMT',
    themes: ['sun', 'water'],
    source: 'srb-ceres',
    units: '%',
    annualUnits: '%',
    agg: 'mean',
    validRange: [0, 100],
    firstYear: 1984,
    homogeneousFrom: 2001,
    palette: 'neutral',
    decimals: 1,
  },
  WS2M: {
    code: 'WS2M',
    themes: ['wind'],
    source: 'merra2-derived',
    units: 'm/s',
    annualUnits: 'm/s',
    agg: 'mean',
    validRange: [0, 75],
    firstYear: 1981,
    palette: 'neutral',
    decimals: 2,
  },
  WS10M: {
    code: 'WS10M',
    themes: ['wind'],
    source: 'merra2-derived',
    units: 'm/s',
    annualUnits: 'm/s',
    agg: 'mean',
    validRange: [0, 75],
    firstYear: 1981,
    palette: 'neutral',
    decimals: 2,
  },
};

export const ALL_CODES: VarCode[] = [...VAR_CODES];

export function isVarCode(x: string): x is VarCode {
  return (VAR_CODES as readonly string[]).includes(x);
}

/** Default first year for analysis: homogeneous segment when one exists. */
export function defaultStartYear(code: VarCode): number {
  const m = CATALOG[code];
  return m.homogeneousFrom ?? m.firstYear;
}
