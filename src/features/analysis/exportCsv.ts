import { CATALOG, type VarCode } from '../../data/catalog';
import type { PointDataset } from '../../data/types';
import { t } from '../../content/i18n';
import { toCsv } from '../../lib/download';
import { monthlyClimatology } from '../../stats/series';
import type { ModelResult } from './model';
import { reportNumbers } from './model';

function attribution(d?: PointDataset): string[][] {
  return [
    [`# ${t().app.name} export, ${new Date().toISOString()}`],
    [`# ${t().footer.power}`],
    d ? [`# Accessed ${d.fetchedAt.slice(0, 10)} — ${d.url}`] : [],
  ].filter((r) => r.length);
}

export function seriesCsv(m: ModelResult, code: VarCode, place: string, d?: PointDataset): string {
  const meta = CATALOG[code];
  const clim = monthlyClimatology(m.windowRecords);
  const rows: unknown[][] = [
    ...attribution(d),
    [`# ${t().vars[code].name} (${code}) at ${place}; monthly units ${meta.units}; annual units ${meta.annualUnits}; period ${m.period[0]}-${m.period[1]}`],
    ['year', 'month', `value_${meta.units}`, 'anomaly'],
    ...m.windowRecords.map((r) => [r.year, r.month, r.value, r.value - clim[r.month - 1]]),
    [],
    ['year', `annual_${meta.agg}_${meta.annualUnits}`],
    ...m.annualRecords.map((a) => [a.year, a.value]),
  ];
  return toCsv(rows);
}

export function statsCsv(m: ModelResult, code: VarCode, place: string, d?: PointDataset): string {
  const tr = m.analysis.trend;
  const r = reportNumbers(m);
  const u = CATALOG[code].annualUnits;
  const rows: unknown[][] = [
    ...attribution(d),
    ['metric', 'value', 'units'],
    ['place', place, ''],
    ['variable', code, ''],
    ['basis', m.analysis.basis, ''],
    ['period_start', m.period[0], ''],
    ['period_end', m.period[1], ''],
    ['n', tr.n, ''],
    ['ols_slope_per_decade', r.perDecade, `${u}/decade`],
    ['ols_slope_ci95_low', r.ci[0], `${u}/decade`],
    ['ols_slope_ci95_high', r.ci[1], `${u}/decade`],
    ['total_change', r.total, u],
    ['p_ols_plain', tr.ols.p, ''],
    ['r1_residuals', tr.adj.r1, ''],
    ['n_eff', tr.adj.nEff, ''],
    ['p_ols_ar1_adjusted', tr.p, ''],
    ['r_squared', tr.ols.r2, ''],
    ['mk_S', tr.mk.s, ''],
    ['mk_varS', tr.mk.varS, ''],
    ['mk_Z', tr.mk.z, ''],
    ['mk_p', tr.mk.p, ''],
    ['kendall_tau', tr.mk.tau, ''],
    ['mk_hamed_rao_p', tr.mkModified.p, ''],
    ['sen_slope_per_decade', r.sen, `${u}/decade`],
    ['sen_ci95_low', r.senCi[0], `${u}/decade`],
    ['sen_ci95_high', r.senCi[1], `${u}/decade`],
    ['seasonal_mk_p', m.analysis.seasonal?.p ?? '', ''],
    ['signal_to_noise', tr.signalToNoise, ''],
    ['verdict', tr.verdict, ''],
    ['years_to_significance', tr.yearsToSignificance ? Math.ceil(tr.yearsToSignificance.year) : '', ''],
    ['warnings', tr.warnings.join(' '), ''],
  ];
  return toCsv(rows);
}
