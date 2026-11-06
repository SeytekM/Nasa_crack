import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PointDataset } from '../../data/types';
import { BUILDING_TYPES, FACTORS, WEIGHTS } from '../../content/siteRules';
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
    for (const b of BUILDING_TYPES) expect(FACTORS.reduce((s, f) => s + WEIGHTS[b][f], 0)).toBeCloseTo(1, 10);
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
