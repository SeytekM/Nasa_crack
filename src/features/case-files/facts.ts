/**
 * Facts for tour texts, computed from the same pipeline as the charts.
 */
import { CATALOG, type VarCode } from '../../data/catalog';
import { pointRecords } from '../../data/adapters';
import type { PointDataset } from '../../data/types';
import { fmtPEq, fmtSigned, withUnits } from '../../lib/format';
import { effectivePeriod } from '../../state/store';
import type { Verdict } from '../../stats';
import { buildModel, reportNumbers } from '../analysis/model';

export interface Fact {
  /** e.g. "+0.77 °C" (per decade) */
  slope: string;
  /** e.g. "+3.4 °C" over the period */
  total: string;
  /** e.g. "p < 0.001" */
  p: string;
  verdict: Verdict;
  /** Year when it would likely become significant, if not significant */
  yts: number | null;
  from: number;
  to: number;
  stepYear: number | null;
}

export type FactFn = (placeId: string, code: VarCode, period?: [number, number]) => Fact;

const EMPTY: Fact = { slope: '…', total: '…', p: 'p = …', verdict: 'insufficient', yts: null, from: 0, to: 0, stepYear: null };

export function makeFacts(data: Record<string, PointDataset | undefined>): FactFn {
  const cache = new Map<string, Fact>();
  return (placeId, code, period) => {
    const key = `${placeId}|${code}|${period?.join('-') ?? ''}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const d = data[placeId];
    if (!d) return EMPTY;
    const meta = CATALOG[code];
    const m = buildModel(pointRecords(d, code), meta, effectivePeriod(code, period ?? null, d.end), 'annual', true);
    const r = reportNumbers(m);
    const tr = m.analysis.trend;
    const f: Fact = {
      slope: withUnits(fmtSigned(r.perDecade), meta.annualUnits),
      total: withUnits(fmtSigned(r.total), meta.annualUnits),
      p: fmtPEq(tr.p),
      verdict: tr.verdict,
      yts: tr.yearsToSignificance ? Math.ceil(tr.yearsToSignificance.year) : null,
      from: Math.round(tr.xStart),
      to: Math.round(tr.xEnd),
      stepYear: tr.warnings.includes('possible-step') && tr.step ? Math.round(tr.step.breakX) : null,
    };
    cache.set(key, f);
    return f;
  };
}
