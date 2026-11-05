import { describe, expect, it } from 'vitest';
import { CsvParseError, parseCsvSeries, parseDateCell } from './csv';

const giovanni = `Title:,Time Series, Area-Averaged of Aerosol Optical Depth 550 nm monthly 1 deg. [MODIS-Terra MOD08_M3 v6.1] over 2001-Jan - 2003-Dec, Region 40N, 70E, 45N, 80E
User Start Date:,2001-01-01T00:00:00Z
User End Date:,2003-12-31T23:59:59Z
Bounding Box:,"70.0,40.0,80.0,45.0"
URL to Reproduce Results:,"https://giovanni.gsfc.nasa.gov/giovanni/#service=ArAvTs"
Fill Value (mean_MOD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined_Mean):,-9999.0

time,mean_MOD08_M3_6_1_AOD_550_Dark_Target_Deep_Blue_Combined_Mean
${Array.from({ length: 36 }, (_, i) => `${2001 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01,${i === 5 ? -9999.0 : (0.2 + 0.001 * i).toFixed(4)}`).join('\n')}
`;

describe('CSV parser', () => {
  it('reads a Giovanni area-averaged export', () => {
    const r = parseCsvSeries(giovanni);
    expect(r.start).toBe(2001);
    expect(r.end).toBe(2003);
    expect(r.records).toHaveLength(36);
    expect(r.resolution).toBe('monthly');
    expect(r.records[5].value).toBeNaN(); // fill value removed
    expect(r.records[0].value).toBeCloseTo(0.2);
    expect(r.rowsUsed).toBe(35);
    expect(r.valueColumn).toContain('AOD');
  });

  it('averages daily data to months and handles semicolons + comments', () => {
    const lines = ['# my station', 'date;temp (°C);flag'];
    for (let d = 1; d <= 31; d++) lines.push(`2020-01-${String(d).padStart(2, '0')};${d % 2 ? 1 : 3};0`);
    for (let d = 1; d <= 29; d++) lines.push(`2020-02-${String(d).padStart(2, '0')};5;0`);
    lines.push('2020-03-01;NaN;0', '2020-03-02;7;0');
    const r = parseCsvSeries(lines.join('\n'));
    expect(r.records[0].value).toBeCloseTo((16 * 1 + 15 * 3) / 31);
    expect(r.records[1].value).toBe(5);
    expect(r.records[2].value).toBe(7);
    expect(r.units).toBe('°C');
    expect(r.valueColumn).toBe('temp (°C)');
  });

  it('accepts YYYYMM keys and annual data', () => {
    expect(parseDateCell('200105')).toEqual({ year: 2001, month: 5 });
    expect(parseDateCell('2001')).toEqual({ year: 2001 });
    expect(parseDateCell('hello')).toBeNull();
    const annual = parseCsvSeries('year,value\n2000,1\n2001,2\n2002,3\n2003,4');
    expect(annual.resolution).toBe('annual');
    expect(annual.records.filter((r) => r.year === 2001).every((r) => r.value === 2)).toBe(true);
  });

  it('gives a helpful error for files without dates', () => {
    expect(() => parseCsvSeries('a,b\n1,2\n3,4')).toThrow(CsvParseError);
  });
});
