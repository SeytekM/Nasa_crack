import { describe, expect, it } from 'vitest';
import raw from '../stats/__fixtures__/power_bishkek_raw.json';
import { normalizeUrlKey } from './cache';
import { ALL_CODES, CATALOG, defaultStartYear } from './catalog';
import { gibsSnapshotUrl, gibsTileUrl, GIBS_LAYERS } from './gibs';
import { clampBBox, lastCompleteYear, parsePointResponse, pointUrl, regionalUrl, toMonthlyArray } from './power';
import { RequestQueue, withRetry, HttpError } from './queue';
import { pointRecords } from './adapters';

describe('POWER URLs', () => {
  it('builds a point URL with sorted, de-duplicated parameters', () => {
    const u = new URL(pointUrl({ lat: 42.9, lon: 74.6, params: ['T2M', 'PRECTOTCORR', 'T2M'], start: 1981, end: 2025 }));
    expect(u.pathname).toBe('/api/temporal/monthly/point');
    expect(u.searchParams.get('parameters')).toBe('PRECTOTCORR,T2M');
    expect(u.searchParams.get('community')).toBe('AG');
  });
  it('rejects more than 25 parameters', () => {
    const params = Array.from({ length: 26 }, (_, i) => `P${i}`);
    expect(() => pointUrl({ lat: 0, lon: 0, params, start: 1981, end: 2025 })).toThrow();
  });
  it('clamps regional bboxes to 2°–10° per axis', () => {
    const b = clampBBox({ latMin: 40, latMax: 41, lonMin: 70, lonMax: 95 });
    expect(b.latMax - b.latMin).toBeCloseTo(2);
    expect(b.lonMax - b.lonMin).toBeCloseTo(10);
    expect((b.latMin + b.latMax) / 2).toBeCloseTo(40.5);
    const edge = clampBBox({ latMin: 85, latMax: 90, lonMin: 175, lonMax: 180 });
    expect(edge.latMax).toBeLessThanOrEqual(90);
    expect(edge.lonMax).toBeLessThanOrEqual(180);
    const u = new URL(regionalUrl({ bbox: b, param: 'T2M', start: 2000, end: 2020 }));
    expect(u.searchParams.get('latitude-min')).toBe(String(b.latMin));
  });
  it('last complete year is the previous calendar year', () => {
    expect(lastCompleteYear(new Date('2026-11-05T00:00:00Z'))).toBe(2025);
  });
});

describe('POWER response parsing', () => {
  it('drops month 13 and maps fill values to null', () => {
    const arr = toMonthlyArray({ '200001': 1, '200002': -999, '200013': 9 }, 2000, 2000);
    expect(arr).toHaveLength(12);
    expect(arr[0]).toBe(1);
    expect(arr[1]).toBeNull();
    expect(arr[2]).toBeNull();
  });
  it('parses a real point response into a compact dataset', () => {
    const d = parsePointResponse(raw as never, { lat: 42.9, lon: 74.6, params: ['T2M', 'PRECTOTCORR'], start: 1981, end: 2025 }, 'x');
    expect(d.params.T2M).toHaveLength(45 * 12);
    expect(d.units.PRECTOTCORR).toBe('mm/day');
    expect(d.elevation).toBeCloseTo(721.28);
    const recs = pointRecords(d, 'T2M');
    expect(recs[0]).toMatchObject({ year: 1981, month: 1 });
    expect(recs.at(-1)).toMatchObject({ year: 2025, month: 12 });
  });
});

describe('cache keys', () => {
  it('normalises parameter order, case and number formatting', () => {
    const a = normalizeUrlKey('https://x.org/api?b=2.50000&A=t2m');
    const b = normalizeUrlKey('https://x.org/api?a=T2M&b=2.5');
    expect(a).toBe(b);
  });
});

describe('catalog', () => {
  it('has 19 verified variables with consistent metadata', () => {
    expect(ALL_CODES).toHaveLength(19);
    for (const c of ALL_CODES) {
      const m = CATALOG[c];
      expect(m.code).toBe(c);
      expect(m.validRange[0]).toBeLessThan(m.validRange[1]);
      expect(m.themes.length).toBeGreaterThan(0);
    }
    expect(CATALOG.PRECTOTCORR.agg).toBe('rateSum');
    expect(CATALOG.FROST_DAYS.agg).toBe('sum');
  });
  it('solar/cloud variables start at the homogeneous CERES segment', () => {
    expect(defaultStartYear('CLOUD_AMT')).toBe(2001);
    expect(defaultStartYear('T2M')).toBe(1981);
  });
});

describe('GIBS helpers', () => {
  it('builds WMTS tile URLs exactly as in GetCapabilities', () => {
    expect(gibsTileUrl(GIBS_LAYERS.blueMarble)).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    );
    expect(gibsTileUrl(GIBS_LAYERS.modisTerra, '2024-07-15')).toContain('/default/2024-07-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg');
  });
  it('WMS 1.3.0 snapshot uses lat,lon axis order', () => {
    const u = new URL(gibsSnapshotUrl({ latMin: 43, latMax: 47, lonMin: 57.5, lonMax: 62.5 }, '2000-08-28'));
    expect(u.searchParams.get('BBOX')).toBe('43,57.5,47,62.5');
    expect(u.searchParams.get('CRS')).toBe('EPSG:4326');
  });
});

describe('request queue', () => {
  it('limits concurrency', async () => {
    const q = new RequestQueue(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      q.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });
    await Promise.all(Array.from({ length: 6 }, task));
    expect(peak).toBe(2);
  });
  it('retries 429 but not 422', async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n++;
          if (n < 3) throw new HttpError(429, '');
          return 'ok';
        },
        { baseDelayMs: 1 },
      ),
    ).resolves.toBe('ok');
    let m = 0;
    await expect(
      withRetry(
        async () => {
          m++;
          throw new HttpError(422, '');
        },
        { baseDelayMs: 1 },
      ),
    ).rejects.toBeInstanceOf(HttpError);
    expect(m).toBe(1);
  });
});
