import { finitePairs } from './descriptive';
import { mannKendall, mannKendallHamedRao, senSlope, seasonalMannKendall, type MannKendallResult, type SenResult, type SeasonalMkResult } from './mannKendall';
import { stepChangeCheck, type StepCheckResult } from './homogeneity';
import { ar1Adjust, ols, type Ar1AdjustedFit, type OlsFit } from './ols';
import { annualAggregate, decimalTime, monthlyAnomalies, monthlyClimatology, toSeasonMatrix, type AnnualAggregation, type MonthlyRecord } from './series';
import { yearsToSignificance, type YearsToSignificanceResult } from './yearsToSignificance';

export type Verdict = 'significant' | 'suggestive' | 'not-significant' | 'insufficient';

/** p < 0.05 → significant; 0.05 ≤ p < 0.10 → suggestive; otherwise not significant (yet). */
export function verdictFromP(p: number): Verdict {
  if (!Number.isFinite(p)) return 'insufficient';
  if (p < 0.05) return 'significant';
  if (p < 0.1) return 'suggestive';
  return 'not-significant';
}

export type WarningCode =
  | 'short-record' // fewer than 10 years
  | 'too-few-points' // fewer than 5 points: no test
  | 'strong-autocorrelation' // r1 > 0.5
  | 'degenerate-autocorrelation' // nEff ≤ 2
  | 'methods-disagree'
  | 'constant' // the variable does not vary here (e.g. no snow)
  | 'possible-step'; // one abrupt jump fits better than a steady trend

export type Agreement = 'agree' | 'significance-differs' | 'direction-differs';

export interface TrendAnalysis {
  n: number;
  xStart: number;
  xEnd: number;
  /** Time span in years between first and last observation. */
  spanYears: number;
  stepYears: number;
  ols: OlsFit;
  adj: Ar1AdjustedFit;
  mk: MannKendallResult;
  mkModified: MannKendallResult & { correction: number };
  sen: SenResult;
  /** Primary p-value: OLS with AR(1) correction (Santer et al. 2000). */
  p: number;
  verdict: Verdict;
  mkVerdict: Verdict;
  agreement: Agreement;
  slopePerDecade: number;
  slopePerDecadeCi: [number, number];
  senPerDecade: number;
  senPerDecadeCi: [number, number];
  /** Slope × span: change implied by the trend line over the record. */
  totalChange: number;
  /** Total change divided by the residual SD ("signal-to-noise"). */
  signalToNoise: number;
  yearsToSignificance: YearsToSignificanceResult | null;
  step: StepCheckResult | null;
  warnings: WarningCode[];
}

export interface AnalyzeOptions {
  /** Observation spacing in years: 1 for annual data, 1/12 for monthly. */
  stepYears: number;
  alpha?: number;
}

/** Full trend analysis of an evenly spaced series (gaps allowed as NaN). */
export function analyzeTrend(xIn: ArrayLike<number>, yIn: ArrayLike<number>, opts: AnalyzeOptions): TrendAnalysis {
  const { x, y } = finitePairs(xIn, yIn);
  const n = y.length;
  const step = opts.stepYears;
  const fit = ols(x, y);
  const adj = ar1Adjust(fit, step);
  const mk = mannKendall(y);
  const mkModified = mannKendallHamedRao(y);
  const sen = senSlope(x, y);
  const warnings: WarningCode[] = [];
  const xStart = x[0];
  const xEnd = x[n - 1];
  const spanYears = n ? xEnd - xStart : 0;
  if (spanYears + step < 10) warnings.push('short-record');
  let p = adj.p;
  const constant = n > 0 && y.every((v) => v === y[0]);
  if (n < 5) {
    warnings.push('too-few-points');
    p = NaN;
  } else if (constant) {
    warnings.push('constant');
    p = NaN;
  }
  const stepCheck = n >= 10 && !constant ? stepChangeCheck(x, y) : null;
  if (stepCheck?.flagged) warnings.push('possible-step');
  if (adj.degenerate) warnings.push('degenerate-autocorrelation');
  else if (adj.r1 > 0.5) warnings.push('strong-autocorrelation');
  const verdict = verdictFromP(p);
  const mkVerdict = n < 5 || constant ? 'insufficient' : verdictFromP(mk.p);
  let agreement: Agreement = 'agree';
  if (constant) agreement = 'agree';
  else if (Math.sign(fit.slope) !== Math.sign(sen.slope) && sen.slope !== 0 && fit.slope !== 0) agreement = 'direction-differs';
  else if ((verdict === 'significant') !== (mkVerdict === 'significant')) agreement = 'significance-differs';
  if (agreement !== 'agree') warnings.push('methods-disagree');
  const totalChange = fit.slope * spanYears;
  const yts =
    verdict === 'significant' || verdict === 'insufficient'
      ? null
      : yearsToSignificance({
          slopePerYear: fit.slope,
          residualSd: fit.residualSd,
          r1: adj.r1,
          n,
          stepYears: step,
          firstTime: xStart,
          alpha: opts.alpha,
        });
  return {
    n,
    xStart,
    xEnd,
    spanYears,
    stepYears: step,
    ols: fit,
    adj,
    mk,
    mkModified,
    sen,
    p,
    verdict,
    mkVerdict,
    agreement,
    slopePerDecade: fit.slope * 10,
    slopePerDecadeCi: [adj.ciLow * 10, adj.ciHigh * 10],
    senPerDecade: sen.slope * 10,
    senPerDecadeCi: [sen.ciLow * 10, sen.ciHigh * 10],
    totalChange,
    signalToNoise: fit.residualSd > 0 ? totalChange / fit.residualSd : NaN,
    yearsToSignificance: yts,
    step: stepCheck,
    warnings,
  };
}

export type AnalysisBasis = 'annual' | 'monthly-anomalies';

export interface SeriesAnalysis {
  basis: AnalysisBasis;
  trend: TrendAnalysis;
  seasonal: SeasonalMkResult | null;
  /** Points the trend was fitted to (decimal years / values). */
  x: number[];
  y: number[];
}

/**
 * Analyse monthly records on the chosen basis:
 * - `annual`: annual aggregates (x = calendar year, 1 point per complete year)
 * - `monthly-anomalies`: deseasonalised monthly values (x = mid-month decimal year)
 * The seasonal Mann-Kendall test on raw monthly values is always added when
 * there are ≥ 3 years of data.
 */
export function analyzeMonthly(recs: MonthlyRecord[], agg: AnnualAggregation, basis: AnalysisBasis = 'annual'): SeriesAnalysis {
  let x: number[];
  let y: number[];
  if (basis === 'annual') {
    const ann = annualAggregate(recs, agg).filter((a) => Number.isFinite(a.value));
    x = ann.map((a) => a.year);
    y = ann.map((a) => a.value);
  } else {
    const an = monthlyAnomalies(recs, monthlyClimatology(recs)).filter((r) => Number.isFinite(r.value));
    x = an.map((r) => decimalTime(r.year, r.month));
    y = an.map((r) => r.value);
  }
  const trend = analyzeTrend(x, y, { stepYears: basis === 'annual' ? 1 : 1 / 12 });
  const years = recs.length ? recs[recs.length - 1].year - recs[0].year + 1 : 0;
  const seasonal = years >= 3 ? seasonalMannKendall(toSeasonMatrix(recs)) : null;
  return { basis, trend, seasonal, x, y };
}
