/**
 * Story regression tests: every claim made in the Case Files must still hold
 * for the bundled data. If `npm run prefetch` brings new data that breaks a
 * story, these tests fail and the tour text must be revised.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PointDataset, RegionalDataset } from '../data/types';
import { makeFacts } from '../features/case-files/facts';
import { trendMapCells } from '../workers/analysisCore';
import { CASES } from './cases';
import { findPreset } from './places';
import { CASE_IMAGES } from './caseImages';

const demo = <T,>(f: string): T => JSON.parse(readFileSync(join(process.cwd(), 'public/data/demo', f), 'utf8')) as T;
const ids = ['svalbard', 'aral', 'ili-plains', 'almaty-mountains', 'bishkek', 'issyk-kul'];
const f = makeFacts(Object.fromEntries(ids.map((id) => [id, demo<PointDataset>(`points/${id}.json`)])));
const positive = (s: string) => s.startsWith('+');
const negative = (s: string) => s.startsWith('−');

describe('Case File claims hold for the bundled data', () => {
  it('every case references bundled presets and images', () => {
    for (const c of CASES) for (const p of c.places) expect(findPreset(p)).toBeDefined();
    const manifest = demo<{ images: { file: string }[] }>('../manifest.json');
    for (const set of CASE_IMAGES) for (const d of set.dates) expect(manifest.images.some((i) => i.file === `demo/images/${set.id}-${d}.jpg`)).toBe(true);
  });

  it('snow: plains lose snow, mountains gain snow — both significant; both warm and moisten', () => {
    const a = f('ili-plains', 'SNODP');
    const b = f('almaty-mountains', 'SNODP');
    expect(negative(a.slope) && a.verdict === 'significant').toBe(true);
    expect(positive(b.slope) && b.verdict === 'significant').toBe(true);
    for (const id of ['ili-plains', 'almaty-mountains']) {
      expect(f(id, 'T2M').verdict).toBe('significant');
      expect(positive(f(id, 'T2M').slope)).toBe(true);
      expect(f(id, 'QV2M').verdict).toBe('significant');
      expect(positive(f(id, 'QV2M').slope)).toBe(true);
    }
    const map = trendMapCells({ data: demo<RegionalDataset>('regions/central-asia-SNODP.json'), period: [1981, 2025] });
    expect(map.nPos).toBeGreaterThan(10);
    expect(map.nNeg).toBeGreaterThan(10);
  });

  it('arctic: warming, less snow, fewer frost days — all significant; whole region warms', () => {
    expect(positive(f('svalbard', 'T2M').slope) && f('svalbard', 'T2M').verdict === 'significant').toBe(true);
    expect(negative(f('svalbard', 'SNODP').slope) && f('svalbard', 'SNODP').verdict === 'significant').toBe(true);
    expect(negative(f('svalbard', 'FROST_DAYS').slope) && f('svalbard', 'FROST_DAYS').verdict === 'significant').toBe(true);
    const map = trendMapCells({ data: demo<RegionalDataset>('regions/svalbard-T2M.json'), period: [1981, 2025] });
    expect(map.nPos).toBe(map.nTests);
  });

  it('aral: hottest hour significant, mean temperature not yet; no FDR-significant cell in the basin', () => {
    expect(f('aral', 'T2M_MAX').verdict).toBe('significant');
    expect(['not-significant', 'suggestive']).toContain(f('aral', 'T2M').verdict);
    expect(f('aral', 'T2M').yts).not.toBeNull();
    const map = trendMapCells({ data: demo<RegionalDataset>('regions/aral-T2M_MAX.json'), period: [1981, 2025] });
    expect(map.nSignificant).toBe(0);
    const raw = demo<PointDataset>('points/aral.json');
    expect(raw.params).not.toHaveProperty('EVPTRNS'); // the "ET = 0" fact was verified on the raw API response (DATA_NOTES)
  });

  it('bishkek: warming significant; cloud cover flagged as a sudden jump', () => {
    expect(f('bishkek', 'T2M').verdict).toBe('significant');
    expect(f('bishkek', 'CLOUD_AMT').stepYear).not.toBeNull();
  });

  it('almost: Issyk-Kul coldest hour is suggestive with a projected year', () => {
    const a = f('issyk-kul', 'T2M_MIN');
    expect(a.verdict).toBe('suggestive');
    expect(a.yts).toBeGreaterThan(2025);
    expect(a.yts).toBeLessThan(2060);
  });
});
