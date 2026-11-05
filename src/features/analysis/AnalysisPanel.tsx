import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { CATALOG, type VarCode } from '../../data/catalog';
import { pointRecords } from '../../data/adapters';
import type { Loaded, PointDataset } from '../../data/types';
import { FIRST_YEAR } from '../../data/power';
import { useT } from '../../content/i18n';
import { Term } from '../../components/Term';
import { Icon } from '../../components/Icon';
import { effectivePeriod, shareUrl, useStore, type ChartToggles } from '../../state/store';
import { downloadDataUrl, downloadText, slug } from '../../lib/download';
import { fmt } from '../../lib/format';
import { buildModel, type ModelResult } from './model';
import { StatsPanel } from './StatsPanel';
import { seriesCsv, statsCsv } from './exportCsv';

const TrendChart = lazy(() => import('./TrendChart'));

const SWATCH: Record<keyof ChartToggles, string> = {
  raw: 'var(--series-raw)',
  ma: 'var(--series-ma)',
  annual: 'var(--series-annual)',
  trend: 'var(--series-trend)',
};

export function useModel(loaded: Loaded<PointDataset> | undefined, code: VarCode, period: [number, number] | null, basis: 'annual' | 'monthly-anomalies', anomalies: boolean): ModelResult | null {
  return useMemo(() => {
    if (!loaded) return null;
    const recs = pointRecords(loaded.data, code);
    const p = effectivePeriod(code, period, loaded.data.end);
    return buildModel(recs, CATALOG[code], p, basis, anomalies);
  }, [loaded, code, period, basis, anomalies]);
}

function ChartToolbar({ m, code }: { m: ModelResult; code: VarCode }) {
  const t = useT();
  const { show, toggleSeries, anomalies, setAnomalies, basis, setBasis, setPeriod, period } = useStore();
  const end = m.chart.extent[1];
  const minYear = Math.max(FIRST_YEAR, CATALOG[code].firstYear);
  const label: Record<keyof ChartToggles, string> = {
    raw: t.chart.raw,
    ma: t.chart.ma,
    annual: t.chart.annual,
    trend: t.chart.trendBand,
  };
  const setFrom = (v: number) => Number.isFinite(v) && setPeriod([Math.min(Math.max(minYear, v), m.period[1] - 2), m.period[1]]);
  const setTo = (v: number) => Number.isFinite(v) && setPeriod([m.period[0], Math.max(Math.min(end, v), m.period[0] + 2)]);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]" data-tour="chart-toolbar">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.explore.show}>
        {(Object.keys(label) as (keyof ChartToggles)[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={show[k]}
            onClick={() => toggleSeries(k)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${show[k] ? 'border-line-strong text-ink-1' : 'border-line text-ink-3 line-through'}`}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SWATCH[k] }} aria-hidden="true" />
            {label[k]}
          </button>
        ))}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 text-ink-2">
        <input type="checkbox" checked={anomalies} onChange={(e) => setAnomalies(e.target.checked)} className="accent-[var(--accent)]" />
        <span>
          <Term id="anomaly">{t.chart.anomaliesShort}</Term> {t.chart.anomaliesSuffix}
        </span>
      </label>
      <div className="inline-flex items-center gap-2">
        <span className="text-ink-3">{t.stats.basis}</span>
        <div className="inline-flex overflow-hidden rounded-md border border-line" role="radiogroup" aria-label={t.stats.basis} title={t.stats.basisHelp}>
          {(['annual', 'monthly-anomalies'] as const).map((b) => (
            <button key={b} type="button" role="radio" aria-checked={basis === b} onClick={() => setBasis(b)} className={`px-2 py-1 ${basis === b ? 'bg-surface-3 text-ink-1' : 'text-ink-3'}`}>
              {b === 'annual' ? t.stats.basisAnnual : t.stats.basisMonthly}
            </button>
          ))}
        </div>
      </div>
      <div className="inline-flex items-center gap-2" data-tour="period">
        <span className="text-ink-3">{t.stats.period}</span>
        <label className="sr-only" htmlFor="from-year">
          {t.stats.from}
        </label>
        <input id="from-year" type="number" className="num w-[4.5rem] rounded-md border border-line bg-surface-2 px-2 py-1" min={minYear} max={m.period[1] - 2} value={m.period[0]} onChange={(e) => setFrom(Number(e.target.value))} />
        <span aria-hidden="true">–</span>
        <label className="sr-only" htmlFor="to-year">
          {t.stats.to}
        </label>
        <input id="to-year" type="number" className="num w-[4.5rem] rounded-md border border-line bg-surface-2 px-2 py-1" min={m.period[0] + 2} max={end} value={m.period[1]} onChange={(e) => setTo(Number(e.target.value))} />
        {period && (
          <button type="button" className="text-accent hover:underline" onClick={() => setPeriod(null)}>
            {t.stats.resetPeriod}
          </button>
        )}
      </div>
    </div>
  );
}

function AnnualTable({ m, code }: { m: ModelResult; code: VarCode }) {
  const t = useT();
  const meta = CATALOG[code];
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-line">
      <table className="num w-full text-[12px]">
        <caption className="sr-only">
          {t.vars[code].name} — {t.chart.annual}
        </caption>
        <thead className="sticky top-0 bg-surface-2 text-ink-3">
          <tr>
            <th className="px-3 py-1 text-left font-normal">{t.chart.yearCol}</th>
            <th className="px-3 py-1 text-right font-normal">
              {t.chart.valueCol} ({meta.annualUnits})
            </th>
          </tr>
        </thead>
        <tbody>
          {m.annualRecords.map((a) => (
            <tr key={a.year} className="border-t border-line">
              <td className="px-3 py-0.5">{a.year}</td>
              <td className="px-3 py-0.5 text-right">{fmt(a.value, meta.decimals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportButtons({ m, code, placeName, loaded, getPng }: { m: ModelResult; code: VarCode; placeName: string; loaded: Loaded<PointDataset>; getPng?: () => string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const base = `etd-${slug(placeName)}-${code.toLowerCase()}-${m.period[0]}-${m.period[1]}`;
  const btn = 'inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink-1';
  return (
    <div className="flex flex-wrap gap-2" data-tour="export">
      <button type="button" className={btn} onClick={() => downloadText(`${base}-series.csv`, seriesCsv(m, code, placeName, loaded.data))}>
        <Icon name="download" size={15} /> {t.export.csvSeries}
      </button>
      <button type="button" className={btn} onClick={() => downloadText(`${base}-stats.csv`, statsCsv(m, code, placeName, loaded.data))}>
        <Icon name="download" size={15} /> {t.export.csvStats}
      </button>
      {getPng && (
        <button type="button" className={btn} onClick={() => downloadDataUrl(`${base}.png`, getPng())}>
          <Icon name="image" size={15} /> {t.export.png}
        </button>
      )}
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(shareUrl());
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt(t.export.share, shareUrl());
          }
        }}
      >
        <Icon name="link" size={15} /> {copied ? t.common.copied : t.export.share}
      </button>
      <span role="status" className="sr-only">
        {copied ? t.export.shareDone : ''}
      </span>
    </div>
  );
}

/** Chart + stats for the current place/variable. */
export function AnalysisPanel({ loaded, placeName }: { loaded: Loaded<PointDataset>; placeName: string }) {
  const t = useT();
  const { varCode, period, basis, anomalies, show, theme, setPeriod } = useStore();
  const m = useModel(loaded, varCode, period, basis, anomalies);
  const pngRef = useRef<(() => string) | undefined>(undefined);
  const [showTable, setShowTable] = useState(false);
  const onReady = useCallback((f: () => string) => {
    pngRef.current = f;
  }, []);
  if (!m) return null;
  const meta = CATALOG[varCode];
  const unitsNote = meta.units !== meta.annualUnits ? t.chart.unitsNote(meta.units, meta.annualUnits) : null;
  return (
    <div className="space-y-4">
      <section className="panel p-3 sm:p-4" aria-label={t.chart.title} data-tour="chart">
        <ChartToolbar m={m} code={varCode} />
        <Suspense fallback={<div className="skeleton mt-3 h-[360px]" />}>
          <div className="mt-2">
            <TrendChart
              model={m.chart}
              show={show}
              units={meta.units}
              decimals={meta.decimals}
              theme={theme}
              onPeriodChange={setPeriod}
              onReady={onReady}
              ariaLabel={`${t.vars[varCode].name} at ${placeName}, ${m.chart.extent[0]}–${m.chart.extent[1]}`}
            />
          </div>
        </Suspense>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
          <span>
            {t.chart.zoomHint} {unitsNote}
          </span>
          <button type="button" className="inline-flex items-center gap-1 text-accent hover:underline" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
            <Icon name="table" size={14} /> {showTable ? t.chart.hideTable : t.chart.table}
          </button>
        </div>
        {showTable && (
          <div className="mt-2">
            <AnnualTable m={m} code={varCode} />
          </div>
        )}
      </section>
      <StatsPanel m={m} code={varCode} />
      <ExportButtons m={m} code={varCode} placeName={placeName} loaded={loaded} getPng={() => pngRef.current?.() ?? ''} />
    </div>
  );
}
