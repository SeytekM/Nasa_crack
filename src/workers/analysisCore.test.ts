import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PointDataset, RegionalDataset } from '../data/types';
import { scanPoint, trendMapCells } from './analysisCore';

const demo = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'public/data/demo', f), 'utf8'));

describe('Detective Scan', () => {
  const rows = scanPoint({ data: demo('points/bishkek.json') as PointDataset });
  it('tests all 19 variables and adjusts p-values (q ≥ p)', () => {
    expect(rows).toHaveLength(19);
    for (const r of rows) if (Number.isFinite(r.p)) expect(r.q).toBeGreaterThanOrEqual(r.p - 1e-12);
  });
  it('orders by verdict and flags the 2017 cloud-cover jump', () => {
    const order = { significant: 0, suggestive: 1, 'not-significant': 2, insufficient: 3 } as const;
    for (let i = 1; i < rows.length; i++) expect(order[rows[i].verdict]).toBeGreaterThanOrEqual(order[rows[i - 1].verdict]);
    const cloud = rows.find((r) => r.code === 'CLOUD_AMT')!;
    expect(cloud.warnings).toContain('possible-step');
    expect(cloud.from).toBe(2001);
    const t2m = rows.find((r) => r.code === 'T2M')!;
    expect(t2m.verdict).toBe('significant');
  });
  it('marks never-varying variables as insufficient (no snow in the tropics)', () => {
    const r = scanPoint({ data: demo('points/manaus.json') as PointDataset }).find((x) => x.code === 'SNODP')!;
    expect(r.verdict).toBe('insufficient');
  });
});

describe('Trend Map', () => {
  it('Central Asia snow depth: significant cells in both directions after Wilks FDR', () => {
    const res = trendMapCells({ data: demo('regions/central-asia-SNODP.json') as RegionalDataset, period: [1981, 2025] });
    expect(res.nTests).toBeGreaterThan(300);
    expect(res.nPos).toBe(35);
    expect(res.nNeg).toBe(35);
    expect(res.threshold).toBeGreaterThan(0);
    expect(res.threshold).toBeLessThan(0.1);
  });
  it('Svalbard warming: every cell significant and positive', () => {
    const res = trendMapCells({ data: demo('regions/svalbard-T2M.json') as RegionalDataset, period: [1981, 2025] });
    expect(res.nPos).toBe(res.nTests);
    expect(res.nNeg).toBe(0);
  });
});
