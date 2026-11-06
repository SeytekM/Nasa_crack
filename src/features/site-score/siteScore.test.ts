import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PointDataset } from '../../data/types';
import { BUILDING_TYPES, CLIMATE_FACTORS, FACTORS, factorWeight, TERRAIN_FACTORS, TERRAIN_WEIGHTS, WEIGHTS } from '../../content/siteRules';
import { DEM_COLORS, LANDSLIDE_COLORS, WATER_COLORS } from '../../data/gibsColormaps';
import { analyzeTerrain, rasterSize, type Raster } from './terrain';
import { areaKm2, centroid, climateStats, combineStats, pointInPolygon, ramp, samplePoints, scoreSite, trendInfo, type Ring } from './siteScore';

const demo = (id: string) => JSON.parse(readFileSync(join(process.cwd(), 'public/data/demo/points', `${id}.json`), 'utf8')) as PointDataset;
const square = (lon: number, lat: number, d: number): Ring => [
  [lon - d, lat - d],
  [lon + d, lat - d],
  [lon + d, lat + d],
  [lon - d, lat + d],
];

describe('polygon geometry', () => {
  it('area of a 1° × 1° square at the equator ≈ 12 390 km²', () => {
    expect(areaKm2(square(0, 0, 0.5))).toBeGreaterThan(12300);
    expect(areaKm2(square(0, 0, 0.5))).toBeLessThan(12500);
  });
  it('centroid and point-in-polygon', () => {
    const c = centroid(square(74.6, 42.9, 0.2));
    expect(c[0]).toBeCloseTo(74.6, 6);
    expect(c[1]).toBeCloseTo(42.9, 6);
    expect(pointInPolygon([74.6, 42.9], square(74.6, 42.9, 0.2))).toBe(true);
    expect(pointInPolygon([75.6, 42.9], square(74.6, 42.9, 0.2))).toBe(false);
  });
  it('samples one point per MERRA-2 cell, capped', () => {
    expect(samplePoints(square(74.6, 42.9, 0.05))).toHaveLength(1); // small plot → centroid only
    const big = samplePoints(square(74.6, 42.9, 2), 6);
    expect(big.length).toBe(6);
    expect(big[0][0]).toBeCloseTo(74.6, 6);
  });
});

describe('scoring rules', () => {
  it('weights of every building type sum to 1', () => {
    for (const b of BUILDING_TYPES) {
      expect(CLIMATE_FACTORS.reduce((s, f) => s + WEIGHTS[b][f], 0)).toBeCloseTo(1, 10);
      expect(TERRAIN_FACTORS.reduce((s, f) => s + TERRAIN_WEIGHTS[b][f], 0)).toBeCloseTo(1, 10);
      expect(FACTORS.reduce((s, f) => s + factorWeight(b, f, true), 0)).toBeCloseTo(1, 10);
      expect(FACTORS.reduce((s, f) => s + factorWeight(b, f, false), 0)).toBeCloseTo(1, 10);
    }
  });
  it('ramp is 100 at good, 0 at bad, linear between, works for decreasing scales', () => {
    expect(ramp(30, { good: 32, bad: 45 })).toBe(100);
    expect(ramp(38.5, { good: 32, bad: 45 })).toBeCloseTo(50);
    expect(ramp(50, { good: 32, bad: 45 })).toBe(0);
    expect(ramp(4, { good: 5.5, bad: 2 })).toBeCloseTo((2 / 3.5) * 100);
  });
});

describe('scores on real NASA POWER data make physical sense', () => {
  const score = (id: string, type: (typeof BUILDING_TYPES)[number]) => {
    const d = demo(id);
    return scoreSite(combineStats([climateStats(d)]).mean, trendInfo(d), type);
  };
  it('totals are integers in 0–100 for every preset and type', () => {
    for (const id of ['bishkek', 'svalbard', 'sahara', 'manaus', 'madrid']) {
      for (const t of BUILDING_TYPES) {
        const s = score(id, t);
        expect(Number.isInteger(s.total)).toBe(true);
        expect(s.total).toBeGreaterThanOrEqual(0);
        expect(s.total).toBeLessThanOrEqual(100);
      }
    }
  });
  it('a solar farm scores much better in the Sahara than in Svalbard', () => {
    expect(score('sahara', 'solar').total).toBeGreaterThan(score('svalbard', 'solar').total + 25);
  });
  it('cold and snow are the main concerns for a school in Svalbard; heat for a hospital in Delhi', () => {
    expect(score('svalbard', 'school').concerns.slice(0, 2)).toEqual(expect.arrayContaining(['cold', 'snow']));
    expect(score('delhi', 'hospital').concerns[0]).toBe('heat');
  });
  it('one severe factor cannot be averaged away (Yakutsk cold, Delhi heat)', () => {
    expect(score('yakutsk', 'hospital').total).toBeLessThan(70);
    expect(score('delhi', 'hospital').total).toBeLessThan(score('madrid', 'hospital').total - 15);
  });
  it('a desert is not penalised for % changes in near-zero rainfall', () => {
    const d = demo('sahara');
    const tr = trendInfo(d);
    expect(tr.precipMean).toBeLessThan(150);
    const s = scoreSite(combineStats([climateStats(d)]).mean, tr, 'hospital');
    expect(s.sub.trend).toBeGreaterThan(70);
  });
});

// ---------------------------------------------------------------- ground (terrain) checks
const W = 40;
const H = 40;
const BOX = { lonMin: 74.5, lonMax: 74.6, latMin: 42.8, latMax: 42.9 };
const RING: Ring = [
  [74.5, 42.8],
  [74.6, 42.8],
  [74.6, 42.9],
  [74.5, 42.9],
];
const rgb = (k: number) => [(k >> 16) & 255, (k >> 8) & 255, k & 255];
function raster(fn: (i: number, j: number) => number | null): Raster {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = fn(i, j);
      if (k === null) continue;
      data.set([...rgb(k), 255], (j * W + i) * 4);
    }
  return { data, width: W, height: H };
}
const demColor = (m: number) => DEM_COLORS.reduce((best, c) => (Math.abs(c[1] - m) < Math.abs(best[1] - m) ? c : best))[0];
const flatDem = (m: number) => raster(() => demColor(m));
const noWater = raster(() => null);
const lowSlide = raster(() => LANDSLIDE_COLORS[0][0]);
const bishkek = () => {
  const d = demo('bishkek');
  return { st: combineStats([climateStats(d)]).mean, tr: trendInfo(d) };
};

describe('ground checks from NASA GIBS rasters', () => {
  it('decodes water share, elevation and flat slopes', () => {
    const g = analyzeTerrain(RING, BOX, { water: raster((i) => (i < 10 ? WATER_COLORS[0] : null)), dem: flatDem(700), landslide: lowSlide });
    expect(g.waterFraction).toBeCloseTo(0.25, 2);
    expect(g.elevMean).toBeGreaterThan(0);
    expect(g.elevMean).toBeGreaterThan(680);
    expect(g.elevMean).toBeLessThan(720);
    expect(g.gentleFraction).toBe(1);
    expect(g.landslideHigh).toBe(0);
  });
  it('an area of open water is "not buildable" even with a pleasant climate', () => {
    const { st, tr } = bishkek();
    const water = analyzeTerrain(RING, BOX, { water: raster(() => WATER_COLORS[0]), dem: raster(() => null), landslide: raster(() => null) });
    const s = scoreSite(st, tr, 'hospital', water);
    expect(s.blocked).toBe('water');
    expect(s.total).toBeLessThanOrEqual(3);
  });
  it('a steep mountain slope is "not buildable"', () => {
    // 0.1° ≈ 8.2 km across 40 px → ~205 m/px; +60 m per pixel ≈ 30 % slope, mean ≈ 2200 m
    const steep = analyzeTerrain(RING, BOX, { water: noWater, dem: raster((i) => demColor(1000 + i * 60)), landslide: lowSlide });
    expect(steep.gentleFraction).toBeLessThan(0.1);
    const { st, tr } = bishkek();
    const s = scoreSite(st, tr, 'school', steep);
    expect(s.blocked).toBe('steep');
    expect(s.total).toBeLessThanOrEqual(15);
  });
  it('a high plateau is "not buildable"; a flat valley keeps a good score', () => {
    const { st, tr } = bishkek();
    const high = scoreSite(st, tr, 'hospital', analyzeTerrain(RING, BOX, { water: noWater, dem: flatDem(5000), landslide: lowSlide }));
    expect(high.blocked).toBe('altitude');
    const valley = scoreSite(st, tr, 'hospital', analyzeTerrain(RING, BOX, { water: noWater, dem: flatDem(700), landslide: lowSlide }));
    expect(valley.blocked).toBeNull();
    expect(valley.terrainUsed).toBe(true);
    expect(valley.total).toBeGreaterThan(70);
  });
  it('high landslide hazard lowers the score', () => {
    const { st, tr } = bishkek();
    const hi = LANDSLIDE_COLORS[LANDSLIDE_COLORS.length - 1][0];
    const safe = scoreSite(st, tr, 'housing', analyzeTerrain(RING, BOX, { water: noWater, dem: flatDem(700), landslide: lowSlide })).total;
    const risky = scoreSite(st, tr, 'housing', analyzeTerrain(RING, BOX, { water: noWater, dem: flatDem(700), landslide: raster(() => hi) })).total;
    expect(risky).toBeLessThan(safe - 15);
  });
  it('raster size aims at ~250 m pixels and stays within 16–512 px', () => {
    const r = rasterSize({ lonMin: 74.5, lonMax: 74.75, latMin: 42.8, latMax: 43.0 });
    expect(r.pixelM).toBeGreaterThan(200);
    expect(r.pixelM).toBeLessThan(300);
    const big = rasterSize({ lonMin: 70, lonMax: 80, latMin: 40, latMax: 48 });
    expect(big.width).toBeLessThanOrEqual(512);
  });
});

describe('weakest link', () => {
  it('a mountain with little gentle land stays low even with a mild climate', () => {
    const { st, tr } = bishkek();
    // ~15 % slope everywhere except a narrow strip: gentle share above the 10 % gate
    const g = analyzeTerrain(RING, BOX, { water: noWater, dem: raster((i) => demColor(1500 + (i < 6 ? 0 : (i - 6) * 70))), landslide: lowSlide });
    expect(g.gentleFraction).toBeGreaterThanOrEqual(0.1);
    const s = scoreSite(st, tr, 'hospital', g);
    expect(s.blocked).toBeNull();
    expect(s.total).toBeLessThanOrEqual(30);
  });
  it('a shoreline (≤ 25 % water) is not penalised', () => {
    const { st, tr } = bishkek();
    const coast = scoreSite(st, tr, 'housing', analyzeTerrain(RING, BOX, { water: raster((i) => (i < 8 ? WATER_COLORS[0] : null)), dem: flatDem(700), landslide: lowSlide }));
    const inland = scoreSite(st, tr, 'housing', analyzeTerrain(RING, BOX, { water: noWater, dem: flatDem(700), landslide: lowSlide }));
    expect(coast.sub.land).toBe(100);
    expect(coast.total).toBe(inland.total);
  });
});

describe('robustness when a ground map fails', () => {
  it('open sea is still detected from missing elevation if the water mask failed', () => {
    const { st, tr } = bishkek();
    const g = analyzeTerrain(RING, BOX, { water: null, dem: raster(() => null), landslide: null });
    expect(g.waterEstimated).toBe(true);
    expect(scoreSite(st, tr, 'hospital', g).blocked).toBe('water');
  });
  it('a lake (flat elevation) without the water mask is flagged incomplete, not "favourable"', () => {
    const { st, tr } = bishkek();
    const s = scoreSite(st, tr, 'hospital', analyzeTerrain(RING, BOX, { water: null, dem: flatDem(1607), landslide: null }));
    expect(s.incomplete).toBe(true);
  });
});
