/**
 * Turns a monthly record + view options into (a) the statistical analysis and
 * (b) everything the chart needs, in consistent units. Pure → unit-tested.
 *
 * Units: the chart always uses the *monthly* units returned by POWER (e.g.
 * mm/day). Trends are reported in *annual* units (e.g. mm/yr). `factor`
 * converts annual → chart units (mean: 1, sum: 12, rateSum: 365.25).
 */
import type { VariableMeta } from '../../data/catalog';
import { decimalYearToMs } from '../../lib/format';
import {
  analyzeMonthly,
  annualAggregate,
  centeredMovingAverage12,
  decimalTime,
  monthlyClimatology,
  regressionBand,
  sliceYears,
  type AnalysisBasis,
  type AnnualAggregation,
  type MonthlyRecord,
  type SeriesAnalysis,
} from '../../stats';

export const AGG_FACTOR: Record<AnnualAggregation, number> = { mean: 1, sum: 12, rateSum: 365.25 };

export interface ChartModel {
  monthly: [number, number | null][];
  ma: [number, number | null][];
  annual: [number, number | null][];
  trend: [number, number][];
  bandLow: [number, number][];
  bandHigh: [number, number][];
  window: [number, number];
  /** First/last year with data (full record). */
  extent: [number, number];
  anomalies: boolean;
}

export interface ModelResult {
  analysis: SeriesAnalysis;
  chart: ChartModel;
  /** Multiply analysis slopes by this to get annual units. */
  displayScale: number;
  factor: number;
  period: [number, number];
  /** Monthly records inside the analysis period. */
  windowRecords: MonthlyRecord[];
  annualRecords: { year: number; value: number }[];
}

const yearMid = (y: number) => decimalYearToMs(y + 0.5);

export function buildModel(
  recs: MonthlyRecord[],
  meta: VariableMeta,
  period: [number, number],
  basis: AnalysisBasis,
  anomalies: boolean,
): ModelResult {
  const factor = AGG_FACTOR[meta.agg];
  const windowRecords = sliceYears(recs, period[0], period[1]);
  const analysis = analyzeMonthly(windowRecords, meta.agg, basis);
  const clim = monthlyClimatology(windowRecords);
  const climMean = clim.filter(Number.isFinite).reduce((a, b) => a + b, 0) / (clim.filter(Number.isFinite).length || 1);

  const monthlyVals = recs.map((r) => (anomalies ? r.value - clim[r.month - 1] : r.value));
  const ma = centeredMovingAverage12(monthlyVals);
  const annualAll = annualAggregate(recs, meta.agg);
  const annualWindow = annualAll.filter((a) => a.year >= period[0] && a.year <= period[1] && Number.isFinite(a.value));
  const annualMeanChart = annualWindow.length ? annualWindow.reduce((s, a) => s + a.value / factor, 0) / annualWindow.length : 0;
  const annualOffset = anomalies ? annualMeanChart : 0;

  const trend: [number, number][] = [];
  const bandLow: [number, number][] = [];
  const bandHigh: [number, number][] = [];
  const t = analysis.trend;
  if (t.n >= 3 && Number.isFinite(t.ols.slope)) {
    const adj = t.adj;
    const opts = adj.degenerate ? {} : { varianceInflation: adj.varianceInflation, df: adj.df };
    if (basis === 'annual') {
      const years: number[] = [];
      for (let y = t.xStart; y <= t.xEnd; y++) years.push(y);
      const band = regressionBand(t.ols, years, opts);
      years.forEach((y, i) => {
        const ms = yearMid(y);
        trend.push([ms, band.fit[i] / factor - annualOffset]);
        bandLow.push([ms, band.low[i] / factor - annualOffset]);
        bandHigh.push([ms, band.high[i] / factor - annualOffset]);
      });
    } else {
      // monthly anomalies: fitted values are anomalies in chart units
      const offset = anomalies ? 0 : climMean;
      const xs: number[] = [];
      for (let x = t.xStart; x <= t.xEnd + 1e-9; x += 1 / 12) xs.push(x);
      const band = regressionBand(t.ols, xs, opts);
      xs.forEach((x, i) => {
        const ms = decimalYearToMs(x);
        trend.push([ms, band.fit[i] + offset]);
        bandLow.push([ms, band.low[i] + offset]);
        bandHigh.push([ms, band.high[i] + offset]);
      });
    }
  }

  const finite = recs.filter((r) => Number.isFinite(r.value));
  const extent: [number, number] = finite.length ? [finite[0].year, finite[finite.length - 1].year] : period;

  return {
    analysis,
    displayScale: basis === 'annual' ? 1 : factor,
    factor,
    period,
    windowRecords,
    annualRecords: annualWindow.map((a) => ({ year: a.year, value: a.value })),
    chart: {
      monthly: recs.map((r, i) => [decimalYearToMs(decimalTime(r.year, r.month)), Number.isFinite(monthlyVals[i]) ? monthlyVals[i] : null]),
      ma: recs.map((r, i) => [decimalYearToMs(decimalTime(r.year, r.month)), Number.isFinite(ma[i]) ? ma[i] : null]),
      annual: annualAll.map((a) => [yearMid(a.year), Number.isFinite(a.value) ? a.value / factor - annualOffset : null]),
      trend,
      bandLow,
      bandHigh,
      window: [Date.UTC(period[0], 0, 1), Date.UTC(period[1] + 1, 0, 1)],
      extent,
      anomalies,
    },
  };
}

/** Slope etc. converted to annual units per decade. */
export function reportNumbers(m: ModelResult) {
  const t = m.analysis.trend;
  const k = m.displayScale;
  return {
    perDecade: t.slopePerDecade * k,
    ci: [t.slopePerDecadeCi[0] * k, t.slopePerDecadeCi[1] * k] as [number, number],
    total: t.totalChange * k,
    sen: t.senPerDecade * k,
    senCi: [t.senPerDecadeCi[0] * k, t.senPerDecadeCi[1] * k] as [number, number],
    seasonalSen: (m.analysis.seasonal?.slope ?? NaN) * 10 * (m.factor === 1 ? 1 : m.factor),
  };
}
