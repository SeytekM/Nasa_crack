/**
 * Site climate-suitability rules (plain data — edit freely).
 *
 * IMPORTANT: this is a CLIMATE screening based only on NASA POWER data
 * (~50 km grid). It does not know about earthquakes, slopes, river flood zones,
 * soil, roads, population or zoning. The UI always says so.
 *
 * Each factor turns one climate statistic into a 0–100 sub-score with a
 * piecewise-linear ramp: `good` → 100, `bad` → 0, linear in between.
 * Thresholds are rough, documented heuristics (see docs/DECISIONS.md D8.x),
 * not engineering codes.
 */

export type BuildingType = 'hospital' | 'school' | 'housing' | 'warehouse' | 'solar';
export const BUILDING_TYPES: BuildingType[] = ['hospital', 'school', 'housing', 'warehouse', 'solar'];

export type ClimateFactor = 'heat' | 'cold' | 'rain' | 'water' | 'snow' | 'wind' | 'solar' | 'trend';
export type TerrainFactor = 'land' | 'slope' | 'altitude' | 'landslide';
export type FactorId = ClimateFactor | TerrainFactor;
export const CLIMATE_FACTORS: ClimateFactor[] = ['heat', 'cold', 'rain', 'water', 'snow', 'wind', 'solar', 'trend'];
export const TERRAIN_FACTORS: TerrainFactor[] = ['land', 'slope', 'altitude', 'landslide'];
export const FACTORS: FactorId[] = [...TERRAIN_FACTORS, ...CLIMATE_FACTORS];

/** Linear ramp: value at `good` (or better) → 100, at `bad` (or worse) → 0. */
export interface Ramp {
  good: number;
  bad: number;
}

export const RAMPS = {
  /** Hottest hour of the year, °C (mean over years). */
  hottestHour: { good: 32, bad: 45 },
  /** Highest monthly dew point of the year, °C — humid-heat proxy. */
  maxDewPoint: { good: 18, bad: 26 },
  /** Coldest hour of the year, °C. */
  coldestHour: { good: -5, bad: -40 },
  /** Frost days per year. */
  frostDays: { good: 30, bad: 250 },
  /** Wettest month of the year, mean rain rate mm/day — heavy-rain proxy. */
  wettestMonth: { good: 5, bad: 20 },
  /** Mean topsoil wetness 0–1 — waterlogging proxy. */
  soilWetness: { good: 0.6, bad: 0.95 },
  /** Annual precipitation mm/yr — local water availability. */
  annualPrecip: { good: 600, bad: 100 },
  /** Deepest monthly snow of the year, cm — snow load & access. */
  maxSnow: { good: 10, bad: 150 },
  /** Mean wind speed at 10 m, m/s. */
  meanWind: { good: 4, bad: 9 },
  /** All-sky solar energy, kWh/m²/day (2001 →, CERES). */
  solar: { good: 5.5, bad: 2 },
  // ---- ground (NASA GIBS rasters) ----
  /** Share of the area that is water (MODIS water mask) — a shoreline is fine, a lake is not. */
  waterFraction: { good: 0.25, bad: 0.75 },
  /** Share of land with slope ≤ 15 % (ASTER GDEM). */
  gentleFraction: { good: 0.8, bad: 0.2 },
  /** Mean land elevation, m — access, construction cost, altitude sickness. */
  elevation: { good: 1500, bad: 4000 },
  /** Share of the area in High/Very High landslide hazard (NASA NDH). */
  landslideHigh: { good: 0, bad: 0.5 },
} as const satisfies Record<string, Ramp>;

/**
 * Hard stops: when one of these holds, the site is "not buildable" and the
 * total is capped, whatever the climate.
 */
export const GATES = {
  /** ≥ 50 % water (sea, lake, ocean) */
  waterFraction: 0.5,
  waterCap: 3,
  /** < 10 % of the land is gentle enough to build on */
  gentleFraction: 0.1,
  steepCap: 15,
  /** mean elevation above 4500 m */
  elevation: 4500,
  altitudeCap: 15,
};

/** Penalties for statistically significant (p < 0.05) adverse trends. */
export const TREND_RULES = {
  /** points lost per +0.1 °C/decade of significant warming of the hottest hour */
  heatPerTenth: 5,
  heatMaxPenalty: 60,
  /** points lost per 1 %/decade of significant change in annual precipitation beyond ±5 %/decade */
  precipPerPercent: 2,
  precipFreeBand: 5,
  precipMaxPenalty: 40,
  /** ignore % precipitation trends where the climate is this dry (tiny totals → huge, meaningless %) */
  precipMinAnnualMm: 150,
};

/**
 * Sub-scores are combined with a WEIGHTED GEOMETRIC MEAN (like the UN Human
 * Development Index): one very poor factor cannot be fully offset by good ones.
 * Sub-scores are floored at this value so a single 0 does not zero everything.
 */
export const GEOMETRIC_FLOOR = 5;

/** Climate factor weights per building type (each row sums to 1). */
export const WEIGHTS: Record<BuildingType, Record<ClimateFactor, number>> = {
  // vulnerable patients: heat & floods matter most; 24/7 access in snow; climate trend
  hospital: { heat: 0.25, cold: 0.1, rain: 0.2, water: 0.1, snow: 0.1, wind: 0.05, solar: 0.05, trend: 0.15 },
  // children: heat stress in class, heating costs, snow closures
  school: { heat: 0.25, cold: 0.15, rain: 0.15, water: 0.05, snow: 0.15, wind: 0.05, solar: 0.05, trend: 0.15 },
  housing: { heat: 0.2, cold: 0.15, rain: 0.2, water: 0.1, snow: 0.1, wind: 0.05, solar: 0.05, trend: 0.15 },
  // structure & goods: flooding, roof snow load, wind
  warehouse: { heat: 0.05, cold: 0.05, rain: 0.3, water: 0.05, snow: 0.2, wind: 0.2, solar: 0.05, trend: 0.1 },
  // solar power plant: sunshine first, then snow on panels, wind, flooding
  solar: { heat: 0.05, cold: 0.05, rain: 0.1, water: 0, snow: 0.15, wind: 0.1, solar: 0.5, trend: 0.05 },
};

/**
 * Weakest link: the total can never exceed base + slope × (worst ground
 * sub-score). Flat dry land (all ground sub-scores 100) is unaffected; a
 * mountain with almost no gentle land cannot be rescued by a mild climate.
 */
export const WEAKEST_LINK = { base: 25, slope: 0.75 };

/** Ground factor weights per building type (each row sums to 1). */
export const TERRAIN_WEIGHTS: Record<BuildingType, Record<TerrainFactor, number>> = {
  hospital: { land: 0.3, slope: 0.3, altitude: 0.2, landslide: 0.2 },
  school: { land: 0.3, slope: 0.3, altitude: 0.2, landslide: 0.2 },
  housing: { land: 0.3, slope: 0.3, altitude: 0.2, landslide: 0.2 },
  warehouse: { land: 0.35, slope: 0.35, altitude: 0.1, landslide: 0.2 },
  solar: { land: 0.3, slope: 0.4, altitude: 0.1, landslide: 0.2 },
};

/** Share of the total that comes from the ground (the rest is climate). */
export const TERRAIN_SHARE: Record<BuildingType, number> = { hospital: 0.45, school: 0.45, housing: 0.45, warehouse: 0.45, solar: 0.4 };

/** Effective weight of a factor in the total (terrain unknown → climate only). */
export function factorWeight(type: BuildingType, f: FactorId, terrainKnown: boolean): number {
  if ((TERRAIN_FACTORS as string[]).includes(f)) return terrainKnown ? TERRAIN_WEIGHTS[type][f as TerrainFactor] * TERRAIN_SHARE[type] : 0;
  return WEIGHTS[type][f as ClimateFactor] * (terrainKnown ? 1 - TERRAIN_SHARE[type] : 1);
}

export interface ScoreBand {
  min: number;
  id: 'favourable' | 'good' | 'challenging' | 'high-risk';
}

export const BANDS: ScoreBand[] = [
  { min: 80, id: 'favourable' },
  { min: 60, id: 'good' },
  { min: 40, id: 'challenging' },
  { min: 0, id: 'high-risk' },
];

/** Climatology window: last 30 complete years (solar: from 2001, CERES only). */
export const CLIMATOLOGY_YEARS = 30;
