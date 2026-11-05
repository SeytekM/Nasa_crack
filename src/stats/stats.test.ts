import { describe, expect, it } from 'vitest';
import fixtures from './__fixtures__/fixtures.json';
import raw from './__fixtures__/power_bishkek_raw.json';
import {
  analyzeMonthly,
  analyzeTrend,
  annualAggregate,
  ar1Adjust,
  benjaminiHochberg,
  betaInc,
  centeredMovingAverage12,
  daysInMonth,
  lnGamma,
  mannKendall,
  mannKendallHamedRao,
  monthlyAnomalies,
  monthlyClimatology,
  normCdf,
  normPpf,
  normSf,
  ols,
  parseYyyymm,
  regressionBand,
  roundHalfEven,
  seasonalMannKendall,
  senSlope,
  senSlopeIndex,
  tPpf,
  tSf,
  verdictFromP,
  wilksFdr,
  yearsToSignificance,
  stepChangeCheck,
} from './index';

type Num = number | null;
const toNum = (v: Num): number => (v === null ? NaN : v);
const arr = (a: Num[]): number[] => a.map(toNum);

/** |a − b| ≤ abs + rel·|b|, NaN equals NaN. */
function close(actual: number, expected: Num, rel = 1e-6, abs = 1e-9) {
  const e = toNum(expected);
  if (Number.isNaN(e)) {
    expect(actual).toBeNaN();
    return;
  }
  const tol = abs + rel * Math.abs(e);
  if (!(Math.abs(actual - e) <= tol)) {
    throw new Error(`expected ${actual} ≈ ${e} (tol ${tol}, diff ${Math.abs(actual - e)})`);
  }
}

describe('special functions vs SciPy', () => {
  it('lnGamma', () => fixtures.special.lnGamma.forEach((c) => close(lnGamma(c.x), c.v, 1e-12, 1e-12)));
  it('betaInc', () => fixtures.special.betainc.forEach((c) => close(betaInc(c.a, c.b, c.x), c.v, 1e-10, 1e-14)));
  it('t survival function', () => fixtures.special.tSf.forEach((c) => close(tSf(c.t, c.df), c.v, 1e-9, 1e-15)));
  it('t quantile', () => fixtures.special.tPpf.forEach((c) => close(tPpf(c.p, c.df), c.v, 1e-9, 1e-12)));
  it('normal cdf / sf / ppf', () => {
    fixtures.special.normCdf.forEach((c) => close(normCdf(c.z), c.v, 1e-10, 1e-16));
    fixtures.special.normSf.forEach((c) => close(normSf(c.z), c.v, 1e-9, 1e-300));
    fixtures.special.normPpf.forEach((c) => close(normPpf(c.p), c.v, 1e-10, 1e-12));
  });
  it('t quantile round-trips with t cdf', () => {
    for (const df of [1, 2.5, 7, 30, 300]) {
      for (const p of [0.001, 0.05, 0.3, 0.9, 0.975]) close(1 - tSf(tPpf(p, df), df), p, 1e-10, 1e-14);
    }
  });
  it('roundHalfEven matches numpy', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, 2.4, 2.6].map(roundHalfEven)).toEqual([0, 2, 2, -0, -2, 2, 3]);
  });
});

describe.each(fixtures.series)('series fixture: $name', (c) => {
  const x = arr(c.x);
  const y = arr(c.y);
  const fit = ols(x, y);

  it('OLS matches scipy.stats.linregress', () => {
    expect(fit.n).toBe(c.ols.n);
    close(fit.slope, c.ols.slope);
    close(fit.intercept, c.ols.intercept);
    close(fit.r, c.ols.r);
    close(fit.p, c.ols.p, 1e-6, 1e-12);
    close(fit.se, c.ols.se);
    close(fit.interceptSe, c.ols.interceptSe);
    close(fit.ciLow, c.ols.ciLow);
    close(fit.ciHigh, c.ols.ciHigh);
    close(fit.residualSd, c.ols.residualSd);
  });

  it('AR(1) adjustment matches NumPy reference (Santer et al. 2000)', () => {
    const a = ar1Adjust(fit, c.step);
    close(a.r1, c.ar1.r1, 1e-8, 1e-12);
    close(a.nEff, c.ar1.nEff);
    close(a.se, c.ar1.se);
    close(a.df, c.ar1.df);
    close(a.t, c.ar1.t);
    close(a.p, c.ar1.p, 1e-6, 1e-12);
    close(a.ciLow, c.ar1.ciLow);
    close(a.ciHigh, c.ar1.ciHigh);
  });

  it('confidence band matches reference', () => {
    const a = ar1Adjust(fit, c.step);
    const band = regressionBand(fit, arr(c.band.x), { varianceInflation: a.varianceInflation, df: a.df });
    band.fit.forEach((v, i) => close(v, c.band.fit[i]));
    band.low.forEach((v, i) => close(v, c.band.low[i]));
    band.high.forEach((v, i) => close(v, c.band.high[i]));
  });

  it('Mann-Kendall matches pymannkendall.original_test', () => {
    const m = mannKendall(y);
    expect(m.n).toBe(c.mk.n);
    expect(m.s).toBe(c.mk.s);
    close(m.varS, c.mk.varS);
    close(m.z, c.mk.z);
    close(m.p, c.mk.p, 1e-6, 1e-12);
    close(m.tau, c.mk.tau);
    const s = senSlopeIndex(y);
    close(s.slope, c.mk.senSlope);
    close(s.intercept, c.mk.senIntercept);
  });

  it('modified MK matches pymannkendall.hamed_rao_modification_test', () => {
    const m = mannKendallHamedRao(y);
    expect(m.s).toBe(c.mkHamedRao.s);
    close(m.varS, c.mkHamedRao.varS);
    close(m.z, c.mkHamedRao.z);
    close(m.p, c.mkHamedRao.p, 1e-6, 1e-12);
  });

  it("Sen's slope + CI match scipy.stats.theilslopes", () => {
    const s = senSlope(x, y);
    close(s.slope, c.sen.slope);
    close(s.intercept, c.sen.intercept);
    close(s.ciLow, c.sen.ciLow);
    close(s.ciHigh, c.sen.ciHigh);
  });

  it('years-to-significance matches brute-force reference', () => {
    const a = ar1Adjust(fit, c.step);
    const firstIdx = y.findIndex(Number.isFinite);
    const r = yearsToSignificance({
      slopePerYear: fit.slope,
      residualSd: fit.residualSd,
      r1: a.r1,
      n: fit.n,
      stepYears: c.step,
      firstTime: x[firstIdx],
    });
    if (c.yts === null) expect(r).toBeNull();
    else {
      expect(r?.nNeeded).toBe(c.yts.nNeeded);
      close(r!.year, c.yts.year);
    }
  });
});

describe('seasonal Mann-Kendall vs pymannkendall.seasonal_test', () => {
  it.each(fixtures.seasonal)('$name', (c) => {
    const m = seasonalMannKendall(c.matrix.map((row) => arr(row as Num[])));
    expect(m.s).toBe(c.smk.s);
    close(m.varS, c.smk.varS);
    close(m.z, c.smk.z);
    close(m.p, c.smk.p, 1e-6, 1e-14);
    close(m.tau, c.smk.tau);
    close(m.slope, c.smk.slope);
  });
});

describe('multiple comparisons', () => {
  it('Benjamini–Hochberg matches scipy.stats.false_discovery_control', () => {
    for (const c of fixtures.fdr.bh) benjaminiHochberg(c.p).forEach((q, i) => close(q, c.q[i], 1e-12, 1e-15));
  });
  it('BH ignores NaN', () => {
    const q = benjaminiHochberg([0.01, NaN, 0.04]);
    expect(q[1]).toBeNaN();
    close(q[0], 0.02);
    close(q[2], 0.04);
  });
  it('Wilks (2016) FDR threshold', () => {
    for (const c of fixtures.fdr.wilks) {
      const r = wilksFdr(c.p, 0.1);
      close(r.threshold, c.threshold, 1e-12, 1e-15);
      expect(r.significant).toEqual(c.significant);
      expect(r.nSignificant).toBe(c.nSignificant);
    }
  });
});

describe('years to significance grid', () => {
  it.each(fixtures.yts)('b=$b s=$s r1=$r1 n=$n', (c) => {
    const r = yearsToSignificance({ slopePerYear: c.b, residualSd: c.s, r1: c.r1, n: c.n, stepYears: c.dt, firstTime: c.first });
    if (c.result === null) expect(r).toBeNull();
    else {
      expect(r?.nNeeded).toBe(c.result.nNeeded);
      close(r!.year, c.result.year);
    }
  });
  it('returns null for a zero slope', () => {
    expect(yearsToSignificance({ slopePerYear: 0, residualSd: 1, r1: 0, n: 30, stepYears: 1, firstTime: 1990 })).toBeNull();
  });
});

describe('preprocessing on a real POWER response', () => {
  const t2m = parseYyyymm(raw.properties.parameter.T2M, { fill: raw.header.fill_value });
  const pr = parseYyyymm(raw.properties.parameter.PRECTOTCORR, { fill: raw.header.fill_value });

  it('drops month 13 and keeps 12 months per year', () => {
    expect(t2m.length).toBe((2025 - 1981 + 1) * 12);
    expect(t2m.every((r) => r.month >= 1 && r.month <= 12)).toBe(true);
    expect(t2m[0]).toMatchObject({ year: 1981, month: 1 });
  });
  it('turns fill values and out-of-range values into NaN', () => {
    const r = parseYyyymm({ '200001': -999, '200002': 5, '200003': 500, '200013': 3 }, { fill: -999, validRange: [-100, 100] });
    expect(r.length).toBe(3);
    expect(r[0].value).toBeNaN();
    expect(r[1].value).toBe(5);
    expect(r[2].value).toBeNaN();
  });
  it('climatology matches NumPy', () => {
    monthlyClimatology(t2m).forEach((v, i) => close(v, fixtures.powerPreproc.climatology[i], 1e-12, 1e-12));
  });
  it('anomalies have zero mean per calendar month', () => {
    const an = monthlyAnomalies(t2m);
    monthlyClimatology(an).forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
  });
  it('day-weighted annual mean and mm/day → mm/yr sum match NumPy', () => {
    const am = annualAggregate(t2m, 'mean');
    am.forEach((a, i) => close(a.value, fixtures.powerPreproc.annualMean.values[i], 1e-12, 1e-12));
    const ap = annualAggregate(pr, 'rateSum');
    ap.forEach((a, i) => close(a.value, fixtures.powerPreproc.annualRateSum.values[i], 1e-12, 1e-12));
  });
  it('annual aggregation drops incomplete years', () => {
    const partial = t2m.filter((r) => !(r.year === 1990 && r.month === 7));
    expect(annualAggregate(partial, 'mean').find((a) => a.year === 1990)?.value).toBeNaN();
  });
  it('2×12 centred moving average matches NumPy', () => {
    const ma = centeredMovingAverage12(t2m.map((r) => r.value));
    fixtures.powerPreproc.movingAverage.forEach((v, i) => close(ma[i], v as Num, 1e-12, 1e-12));
  });
  it('days in month handles leap years', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe('high-level analysis and verdicts', () => {
  it('verdict thresholds follow the spec', () => {
    expect(verdictFromP(0.001)).toBe('significant');
    expect(verdictFromP(0.0499)).toBe('significant');
    expect(verdictFromP(0.05)).toBe('suggestive');
    expect(verdictFromP(0.0999)).toBe('suggestive');
    expect(verdictFromP(0.1)).toBe('not-significant');
    expect(verdictFromP(NaN)).toBe('insufficient');
  });

  it('Bishkek T2M annual: significant warming, consistent with fixtures', () => {
    const t2m = parseYyyymm(raw.properties.parameter.T2M, { fill: raw.header.fill_value });
    const a = analyzeMonthly(t2m, 'mean', 'annual');
    const ref = fixtures.series.find((s) => s.name === 'power-bishkek-t2m-annual')!;
    close(a.trend.ols.slope, ref.ols.slope);
    close(a.trend.p, ref.ar1.p, 1e-6, 1e-12);
    expect(a.trend.verdict).toBe('significant');
    close(a.trend.slopePerDecade, ref.ols.slope * 10);
    close(a.trend.totalChange, ref.ols.slope * 44);
    expect(a.trend.yearsToSignificance).toBeNull();
    expect(a.seasonal?.p).toBeLessThan(0.05);
  });

  it('Bishkek precipitation: not significant, projects a year', () => {
    const pr = parseYyyymm(raw.properties.parameter.PRECTOTCORR, { fill: raw.header.fill_value });
    const a = analyzeMonthly(pr, 'rateSum', 'annual');
    expect(a.trend.verdict).toBe('not-significant');
    const ref = fixtures.series.find((s) => s.name === 'power-bishkek-precip-annual')!;
    expect(a.trend.yearsToSignificance?.nNeeded).toBe(ref.yts!.nNeeded);
  });

  it('monthly-anomaly basis matches the monthly fixture', () => {
    const t2m = parseYyyymm(raw.properties.parameter.T2M, { fill: raw.header.fill_value });
    const a = analyzeMonthly(t2m, 'mean', 'monthly-anomalies');
    const ref = fixtures.series.find((s) => s.name === 'power-bishkek-t2m-monthly-anomalies')!;
    close(a.trend.ols.slope, ref.ols.slope);
    close(a.trend.adj.r1, ref.ar1.r1, 1e-8, 1e-12);
    close(a.trend.p, ref.ar1.p, 1e-6, 1e-12);
  });

  it('flags short records and refuses tests on < 5 points', () => {
    const short = analyzeTrend([2000, 2001, 2002, 2003], [1, 2, 3, 5], { stepYears: 1 });
    expect(short.warnings).toContain('short-record');
    expect(short.warnings).toContain('too-few-points');
    expect(short.verdict).toBe('insufficient');
  });

  it('caps nEff at n when residual autocorrelation is negative', () => {
    const fit = ols([1, 2, 3, 4, 5, 6, 7, 8], [1, 3, 2, 4, 3, 5, 4, 6]);
    const a = ar1Adjust(fit, 1);
    expect(a.r1).toBeLessThan(0);
    expect(a.nEff).toBe(8);
    close(a.p, fit.p);
  });

  it('constant series does not crash', () => {
    const a = analyzeTrend([1, 2, 3, 4, 5, 6], [2, 2, 2, 2, 2, 2], { stepYears: 1 });
    expect(a.ols.slope).toBe(0);
    expect(a.mk.s).toBe(0);
    expect(a.verdict).toBe('insufficient');
  });
});

describe('step-change (homogeneity) check', () => {
  const x = Array.from({ length: 30 }, (_, i) => 1990 + i);
  const noise = x.map((_, i) => 0.1 * Math.sin(i * 1.7) + 0.05 * Math.cos(i * 3.1));
  it('flags a series that is one abrupt jump', () => {
    const y = x.map((xi, i) => (xi >= 2005 ? 2 : 0) + noise[i]);
    const r = stepChangeCheck(x, y)!;
    expect(r.flagged).toBe(true);
    expect(r.breakX).toBe(2005);
    expect(r.stepSize).toBeCloseTo(2, 1);
  });
  it('does not flag a steady trend', () => {
    const y = x.map((xi, i) => 0.05 * (xi - 1990) + noise[i]);
    expect(stepChangeCheck(x, y)!.flagged).toBe(false);
  });
  it('returns null for short series and analyzeTrend reports the warning', () => {
    expect(stepChangeCheck([1, 2, 3], [1, 2, 3])).toBeNull();
    const y = x.map((xi, i) => (xi >= 2005 ? 2 : 0) + noise[i]);
    expect(analyzeTrend(x, y, { stepYears: 1 }).warnings).toContain('possible-step');
  });
  it('constant series → insufficient with "constant" warning', () => {
    const a = analyzeTrend(x, x.map(() => 0), { stepYears: 1 });
    expect(a.verdict).toBe('insufficient');
    expect(a.warnings).toContain('constant');
  });
});
