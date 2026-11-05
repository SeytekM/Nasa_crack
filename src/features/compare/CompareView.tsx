import { lazy, Suspense, useEffect, useMemo } from 'react';
import { CATALOG } from '../../data/catalog';
import { useT } from '../../content/i18n';
import { Icon } from '../../components/Icon';
import { Stamp } from '../../components/Stamp';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { fmt, fmtLatLon, fmtPEq, fmtSigned, withUnits } from '../../lib/format';
import { normTwoSidedP } from '../../stats';
import { usePointEntry, useStore } from '../../state/store';
import type { PlaceRef } from '../../state/url';
import { useModel } from '../analysis/AnalysisPanel';
import { Headline } from '../analysis/StatsPanel';
import { reportNumbers, type ModelResult } from '../analysis/model';
import { VariablePicker } from '../analysis/VariablePicker';
import { PlacePicker } from '../explore/PlacePicker';
import { placeLabel } from '../explore/ExploreView';

const TrendChart = lazy(() => import('../analysis/TrendChart'));

function yRangeOf(models: (ModelResult | null)[], show: { raw: boolean }): [number, number] | undefined {
  const vals: number[] = [];
  for (const m of models) {
    if (!m) continue;
    const series = [...(show.raw ? m.chart.monthly : []), ...m.chart.ma, ...m.chart.annual, ...m.chart.bandLow, ...m.chart.bandHigh];
    for (const [, v] of series) if (v !== null && Number.isFinite(v)) vals.push(v);
  }
  if (!vals.length) return undefined;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  // "nice" step so both charts get round, identical axis labels
  const raw = (hi - lo) / 5 || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

function Side({ label, place, onPick, m }: { label: string; place: PlaceRef; onPick: (p: PlaceRef) => void; m: ModelResult | null }) {
  const t = useT();
  const entry = usePointEntry(place);
  const { varCode } = useStore();
  return (
    <div className="panel space-y-3 p-4" data-tour={`compare-${label === t.compare.placeA ? 'a' : 'b'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            {label}
          </div>
          <h2 className="text-xl font-semibold">{placeLabel(place)}</h2>
          <p className="num text-[11px] text-ink-3">
            {fmtLatLon(place.lat, place.lon)}
            {entry?.loaded?.data.elevation != null && ` · ${Math.round(entry.loaded.data.elevation)} m`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entry?.loaded && <ProvenanceChip loaded={entry.loaded} />}
          {m && <Stamp verdict={m.analysis.trend.verdict} size="sm" />}
        </div>
      </div>
      <details className="text-[13px]">
        <summary className="cursor-pointer text-accent">{t.compare.pick}</summary>
        <div className="mt-2">
          <PlacePicker key={`${place.lat},${place.lon}`} value={place} onPick={onPick} compact />
        </div>
      </details>
      {entry?.status === 'error' && !entry.loaded && <p className="text-stamp-sug">{entry.error}</p>}
      {!m && entry?.status !== 'error' && <div className="skeleton h-24" />}
      {m && <Headline m={m} code={varCode} />}
    </div>
  );
}

export default function CompareView() {
  const t = useT();
  const { compareA, compareB, setCompare, swapCompare, varCode, setVar, period, basis, anomalies, show, theme, ensurePoint } = useStore();
  const ea = usePointEntry(compareA);
  const eb = usePointEntry(compareB);
  useEffect(() => {
    void ensurePoint(compareA);
    void ensurePoint(compareB);
  }, [compareA, compareB, ensurePoint]);
  const ma = useModel(ea?.loaded, varCode, period, basis, anomalies);
  const mb = useModel(eb?.loaded, varCode, period, basis, anomalies);
  const yRange = useMemo(() => yRangeOf([ma, mb], show), [ma, mb, show]);
  const meta = CATALOG[varCode];

  const diff = useMemo(() => {
    if (!ma || !mb) return null;
    const a = ma.analysis.trend;
    const b = mb.analysis.trend;
    if (a.adj.degenerate || b.adj.degenerate || a.verdict === 'insufficient' || b.verdict === 'insufficient') return null;
    const ra = reportNumbers(ma);
    const rb = reportNumbers(mb);
    const seA = a.adj.se * 10 * ma.displayScale;
    const seB = b.adj.se * 10 * mb.displayScale;
    const d = rb.perDecade - ra.perDecade;
    const z = d / Math.sqrt(seA * seA + seB * seB);
    return { d, z, p: normTwoSidedP(z), ra, rb };
  }, [ma, mb]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-3 pb-10 sm:px-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{t.nav.compare}</div>
          <h1 className="text-2xl font-semibold">{t.compare.title}</h1>
        </div>
        <button type="button" onClick={swapCompare} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-ink-2 hover:text-ink-1">
          <Icon name="swap" size={16} /> {t.compare.swap}
        </button>
      </header>
      <section className="panel p-4">
        <VariablePicker value={varCode} onChange={setVar} id="compare-var" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Side label={t.compare.placeA} place={compareA} onPick={(p) => setCompare('a', p)} m={ma} />
        <Side label={t.compare.placeB} place={compareB} onPick={(p) => setCompare('b', p)} m={mb} />
      </div>

      {diff && (
        <section className="panel p-4" aria-labelledby="diff-title" data-tour="compare-diff">
          <h2 id="diff-title" className="eyebrow mb-2">
            {t.compare.diff}
          </h2>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div className="num text-2xl font-medium">
              {withUnits(fmtSigned(diff.d), meta.annualUnits)} <span className="text-[13px] text-ink-3">{t.common.perDecade}</span>
            </div>
            <div className="num text-[13px] text-ink-2">
              A {withUnits(fmtSigned(diff.ra.perDecade), meta.annualUnits)} · B {withUnits(fmtSigned(diff.rb.perDecade), meta.annualUnits)}
            </div>
            <div className="num text-[13px] text-ink-3">{t.compare.diffNote(fmt(diff.z, 2), fmtPEq(diff.p))}</div>
          </div>
          {Math.sign(diff.ra.perDecade) !== Math.sign(diff.rb.perDecade) && ma?.analysis.trend.verdict === 'significant' && mb?.analysis.trend.verdict === 'significant' && (
            <p className="mt-2 text-ink-1">{t.compare.opposite}</p>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {[ma, mb].map((m, i) => (
          <section key={i} className="panel p-3" aria-label={`${t.chart.title} ${i === 0 ? 'A' : 'B'}`}>
            {m ? (
              <Suspense fallback={<div className="skeleton h-[300px]" />}>
                <TrendChart
                  model={m.chart}
                  show={show}
                  units={meta.units}
                  decimals={meta.decimals}
                  theme={theme}
                  yRange={yRange}
                  height={300}
                  noZoom
                  ariaLabel={`${t.vars[varCode].name} — ${placeLabel(i === 0 ? compareA : compareB)}`}
                />
              </Suspense>
            ) : (
              <div className="skeleton h-[300px]" />
            )}
          </section>
        ))}
      </div>
      <p className="text-[12px] text-ink-3">{t.compare.sameAxes}</p>
    </div>
  );
}
