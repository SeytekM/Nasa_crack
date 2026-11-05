import { describe, expect, it } from 'vitest';
import raw from '../../stats/__fixtures__/power_bishkek_raw.json';
import { CATALOG } from '../../data/catalog';
import { parsePointResponse } from '../../data/power';
import { pointRecords } from '../../data/adapters';
import { buildModel, reportNumbers } from './model';
import { classifyTerrain, placeClimate, recommend } from '../../content/rules';

const d = parsePointResponse(raw as never, { lat: 42.9, lon: 74.6, params: ['T2M', 'PRECTOTCORR'], start: 1981, end: 2025 }, 'x');

describe('chart model', () => {
  it('precipitation: trends in mm/yr, chart in mm/day, dots sit on the same scale as the trend line', () => {
    const m = buildModel(pointRecords(d, 'PRECTOTCORR'), CATALOG.PRECTOTCORR, [1981, 2025], 'annual', false);
    expect(m.factor).toBe(365.25);
    const first = m.annualRecords[0].value / 365.25;
    const dot = m.chart.annual.find((a) => a[1] !== null)![1]!;
    expect(dot).toBeCloseTo(first, 10);
    // trend line at mid-1981 equals (a + b·1981)/365.25
    const fit = m.analysis.trend.ols;
    expect(m.chart.trend[0][1]).toBeCloseTo((fit.intercept + fit.slope * 1981) / 365.25, 10);
    expect(m.chart.bandLow[0][1]).toBeLessThan(m.chart.trend[0][1]);
  });
  it('monthly-anomaly basis reports slopes in annual units', () => {
    const a = buildModel(pointRecords(d, 'T2M'), CATALOG.T2M, [1981, 2025], 'monthly-anomalies', true);
    const r = reportNumbers(a);
    expect(r.perDecade).toBeCloseTo(a.analysis.trend.ols.slope * 10, 10);
    expect(a.displayScale).toBe(1);
  });
  it('anomaly mode centres the yearly dots around zero', () => {
    const m = buildModel(pointRecords(d, 'T2M'), CATALOG.T2M, [1981, 2025], 'annual', true);
    const vals = m.chart.annual.map((a) => a[1]!).filter((v) => v !== null);
    expect(Math.abs(vals.reduce((s, v) => s + v, 0) / vals.length)).toBeLessThan(1e-9);
  });
});

describe('terrain rules', () => {
  it('classifies Bishkek and recommends 3–5 leads', () => {
    const full = { ...d, params: { ...d.params, SNODP: new Array(540).fill(0) } };
    const c = placeClimate(full);
    expect(c.meanT).toBeGreaterThan(5);
    const terrain = classifyTerrain(c);
    expect(['steppe', 'temperate']).toContain(terrain);
    const leads = recommend(terrain, 'heat');
    expect(leads.length).toBeGreaterThanOrEqual(3);
    expect(leads.length).toBeLessThanOrEqual(5);
  });
});
