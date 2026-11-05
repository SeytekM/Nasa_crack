/**
 * "Detective intuition" without AI: classify the place from its own
 * climatology, then recommend variables for the chosen theme.
 * Edit TERRAIN_RULES / RECOMMENDATIONS to extend — they are plain data.
 */
import { CATALOG, type Theme, type VarCode } from '../data/catalog';
import { pointRecords } from '../data/adapters';
import type { PointDataset } from '../data/types';
import { annualAggregate } from '../stats/series';

export type TerrainType = 'polar' | 'mountain' | 'desert' | 'steppe' | 'tropical-humid' | 'tropical-seasonal' | 'boreal' | 'temperate';

export interface PlaceClimate {
  lat: number;
  elevation: number;
  /** Mean annual air temperature, °C */
  meanT: number;
  /** Mean annual precipitation, mm/yr */
  precip: number;
  /** Mean snow depth over the year, cm */
  snow: number;
  /** Mean coldest-month temperature, °C */
  coldestMonthT: number;
}

const avg = (xs: number[]) => {
  const f = xs.filter(Number.isFinite);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN;
};

export function placeClimate(d: PointDataset): PlaceClimate {
  const yearly = (code: VarCode) => avg(annualAggregate(pointRecords(d, code), CATALOG[code].agg).map((a) => a.value));
  const t = pointRecords(d, 'T2M');
  const monthMeans = Array.from({ length: 12 }, (_, m) => avg(t.filter((r) => r.month === m + 1).map((r) => r.value)));
  return {
    lat: d.lat,
    elevation: d.elevation ?? 0,
    meanT: yearly('T2M'),
    precip: yearly('PRECTOTCORR'),
    snow: yearly('SNODP'),
    coldestMonthT: Math.min(...monthMeans.filter(Number.isFinite)),
  };
}

/** Ordered rules: the first match wins. */
export const TERRAIN_RULES: { type: TerrainType; when: (c: PlaceClimate) => boolean }[] = [
  { type: 'polar', when: (c) => Math.abs(c.lat) >= 64 || c.meanT < -5 },
  { type: 'mountain', when: (c) => c.elevation >= 2000 || (c.elevation >= 1200 && c.snow > 5) },
  { type: 'desert', when: (c) => c.precip < 250 },
  { type: 'tropical-humid', when: (c) => Math.abs(c.lat) < 23.5 && c.precip >= 1500 && c.meanT >= 20 },
  { type: 'tropical-seasonal', when: (c) => Math.abs(c.lat) < 23.5 && c.meanT >= 18 },
  { type: 'steppe', when: (c) => c.precip < 500 },
  { type: 'boreal', when: (c) => c.coldestMonthT < -8 || c.snow > 10 },
  { type: 'temperate', when: () => true },
];

export function classifyTerrain(c: PlaceClimate): TerrainType {
  return TERRAIN_RULES.find((r) => r.when(c))!.type;
}

export interface Lead {
  code: VarCode;
  /** Short reason, specific to terrain × theme. */
  reason: string;
}

type RecTable = Partial<Record<TerrainType, Partial<Record<Theme, Lead[]>>>>;

/** Terrain-specific leads. Missing combinations fall back to THEME_DEFAULTS. */
export const RECOMMENDATIONS: RecTable = {
  desert: {
    heat: [
      { code: 'T2M_MAX', reason: 'Dry ground cannot cool itself by evaporation, so heat extremes are the first place to look.' },
      { code: 'T2M_RANGE', reason: 'Clear, dry air gives huge day–night swings; a change in the swing hints at changing humidity or dust.' },
      { code: 'T2M', reason: 'The overall warming signal — compare it with the hottest hour.' },
      { code: 'RH2M', reason: 'In deserts, relative humidity can drop as it warms even if moisture is constant.' },
    ],
    water: [
      { code: 'GWETTOP', reason: 'Topsoil wetness reacts to the rare rain events — the best water signal in a desert.' },
      { code: 'PRECTOTCORR', reason: 'Small totals mean big year-to-year swings — expect noisy data and wide confidence bands.' },
      { code: 'QV2M', reason: 'The actual moisture in the air; can rise with warmer seas nearby.' },
      { code: 'RH2M', reason: 'Tells you whether the air is getting “thirstier”.' },
    ],
  },
  steppe: {
    heat: [
      { code: 'T2M', reason: 'Continental interiors are warming faster than the global average.' },
      { code: 'T2M_MAX', reason: 'Heat waves stress crops and pastures.' },
      { code: 'FROST_DAYS', reason: 'A shorter frost season changes the growing season.' },
    ],
    water: [
      { code: 'PRECTOTCORR', reason: 'Semi-arid lands sit on the edge — a small change in rain matters a lot.' },
      { code: 'GWETROOT', reason: 'Root-zone moisture decides whether grass and crops survive the summer.' },
      { code: 'QV2M', reason: 'Is the air itself getting moister?' },
    ],
  },
  polar: {
    heat: [
      { code: 'T2M', reason: 'The Arctic warms several times faster than the global average (“Arctic amplification”).' },
      { code: 'T2M_MIN', reason: 'Winter and night temperatures usually change the most at high latitudes.' },
      { code: 'TS', reason: 'Surface temperature responds to retreating snow and sea ice.' },
    ],
    snow: [
      { code: 'SNODP', reason: 'If winters are getting warmer and shorter, the snow on the ground should shrink — does it?' },
      { code: 'FROST_DAYS', reason: 'Counting frost days turns warming into something you can feel.' },
      { code: 'T2M_MIN', reason: 'Snow lasts only while it stays cold enough.' },
      { code: 'PRECTOTCORR', reason: 'More moisture can mean more snowfall — the two effects compete.' },
    ],
    water: [
      { code: 'QV2M', reason: 'Warmer polar air holds more moisture.' },
      { code: 'PRECTOTCORR', reason: 'More open water nearby can feed more precipitation.' },
      { code: 'RH2M', reason: 'Check whether humidity keeps up with warming.' },
    ],
  },
  mountain: {
    snow: [
      { code: 'SNODP', reason: 'High up it may still be cold enough for extra moisture to fall as snow — the trend can go either way.' },
      { code: 'FROST_DAYS', reason: 'The frost season shortens as nights warm.' },
      { code: 'PRECTOTCORR', reason: 'Snow needs precipitation: check whether more is falling.' },
      { code: 'T2M_MIN', reason: 'The coldest hours decide whether precipitation falls as snow or rain.' },
    ],
    heat: [
      { code: 'T2M', reason: 'Mountains can warm differently from the valleys below (“elevation-dependent warming”).' },
      { code: 'T2M_MIN', reason: 'Cold nights control snow and ice.' },
      { code: 'FROST_DAYS', reason: 'A practical measure of a shorter cold season.' },
    ],
    water: [
      { code: 'PRECTOTCORR', reason: 'Mountains catch moisture; their rain and snow feed rivers far below. (Mountain precipitation is hard for models — check it against other data.)' },
      { code: 'GWETTOP', reason: 'Soil wetness shows if extra precipitation stays in the ground.' },
      { code: 'QV2M', reason: 'Is warmer air bringing more moisture up the slopes?' },
    ],
  },
  'tropical-humid': {
    water: [
      { code: 'PRECTOTCORR', reason: 'Rainforests depend on steady rain; longer dry seasons are a key risk.' },
      { code: 'GWETROOT', reason: 'Deep soil moisture keeps forests green through dry spells.' },
      { code: 'RH2M', reason: 'Drier air raises fire risk.' },
    ],
    heat: [
      { code: 'T2M_MAX', reason: 'Hot extremes plus humidity limit how well people and forests cope.' },
      { code: 'T2MDEW', reason: 'A higher dew point makes heat feel more oppressive.' },
      { code: 'T2M', reason: 'The baseline warming signal.' },
    ],
  },
  'tropical-seasonal': {
    water: [
      { code: 'PRECTOTCORR', reason: 'Wet-season rain feeds crops and rivers; shifts here matter for millions.' },
      { code: 'GWETTOP', reason: 'Shows how quickly soils dry after the rains.' },
      { code: 'QV2M', reason: 'Moisture supply for the rainy season.' },
    ],
    heat: [
      { code: 'T2M_MAX', reason: 'The hot season before the rains is getting more intense in many places.' },
      { code: 'T2M', reason: 'The baseline warming signal.' },
      { code: 'T2MDEW', reason: 'Humid heat is more dangerous than dry heat.' },
    ],
  },
  boreal: {
    snow: [
      { code: 'SNODP', reason: 'Long snowy winters are shrinking at their warm edge.' },
      { code: 'FROST_DAYS', reason: 'The frost season is shortening.' },
      { code: 'T2M_MIN', reason: 'Winter cold extremes respond strongly to warming.' },
    ],
    heat: [
      { code: 'T2M_MIN', reason: 'Winter cold extremes respond strongly to warming.' },
      { code: 'T2M', reason: 'High-latitude land warms faster than the global average.' },
      { code: 'FROST_DAYS', reason: 'A practical measure of shorter winters.' },
    ],
  },
};

/** Generic leads per theme (used when the terrain table has no entry). */
export const THEME_DEFAULTS: Record<Theme, Lead[]> = {
  heat: [
    { code: 'T2M', reason: 'The headline warming signal.' },
    { code: 'T2M_MAX', reason: 'Are the hottest hours getting hotter?' },
    { code: 'T2M_MIN', reason: 'Are the coldest hours getting milder?' },
    { code: 'FROST_DAYS', reason: 'Fewer frost days = shorter cold season.' },
  ],
  water: [
    { code: 'PRECTOTCORR', reason: 'How much rain and snow falls in a year.' },
    { code: 'GWETROOT', reason: 'Is the soil getting wetter or drier where plants need water?' },
    { code: 'QV2M', reason: 'How much moisture the air holds.' },
    { code: 'RH2M', reason: 'How close the air is to saturation.' },
  ],
  snow: [
    { code: 'SNODP', reason: 'How much snow lies on the ground.' },
    { code: 'FROST_DAYS', reason: 'How many days are cold enough for frost.' },
    { code: 'T2M_MIN', reason: 'The coldest hours decide snow vs rain.' },
  ],
  sun: [
    { code: 'ALLSKY_SFC_SW_DWN', reason: 'Total sunlight reaching the ground (affected by clouds and haze).' },
    { code: 'CLRSKY_SFC_SW_DWN', reason: 'Sunlight without clouds — tracks dust and pollution.' },
    { code: 'CLOUD_AMT', reason: 'Cloud cover — but satellite cloud records can contain artificial jumps.' },
  ],
  wind: [
    { code: 'WS10M', reason: 'Wind at weather-station height.' },
    { code: 'WS2M', reason: 'Wind near the ground, felt by crops and people.' },
    { code: 'QV2M', reason: 'Moisture carried by the air.' },
    { code: 'RH2M', reason: 'How humid the air feels.' },
  ],
};

/** 3–5 leads for a place and theme, terrain-specific first, then theme defaults. */
export function recommend(terrain: TerrainType, theme: Theme): Lead[] {
  const specific = RECOMMENDATIONS[terrain]?.[theme] ?? [];
  const out: Lead[] = [...specific];
  for (const l of THEME_DEFAULTS[theme]) if (!out.some((o) => o.code === l.code)) out.push(l);
  return out.slice(0, Math.max(3, Math.min(5, specific.length || 4)));
}
