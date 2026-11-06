import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CODES } from '../../data/catalog';
import { loadPoint } from '../../data/loader';
import { FIRST_YEAR } from '../../data/power';
import type { Provenance } from '../../data/types';
import { useT } from '../../content/i18n';
import { BUILDING_TYPES, FACTORS, WEIGHTS, type FactorId } from '../../content/siteRules';
import { Icon } from '../../components/Icon';
import { fmt, fmtSigned } from '../../lib/format';
import { END_YEAR, useStore } from '../../state/store';
import { areaKm2, bboxOf, climateStats, combineStats, samplePoints, scoreSite, trendInfo, type ClimateStats, type TrendInfo } from './siteScore';

type Combined = ReturnType<typeof combineStats>;

interface EvalState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  done?: number;
  total?: number;
  stats?: Combined;
  trend?: TrendInfo;
  provenance?: Provenance[];
  error?: string;
}

/** Circular 0–100 gauge; the number and the band text carry the meaning, not colour. */
function Gauge({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="74" textAnchor="middle" className="num" fontSize="34" fontWeight="600" fill="var(--ink-1)">
        {value}
      </text>
    </svg>
  );
}

function detailLine(f: FactorId, s: ClimateStats, tr: TrendInfo, t: ReturnType<typeof useT>): string {
  const d = t.site.detail;
  switch (f) {
    case 'heat':
      return d.heat(fmt(s.hottestHour, 1), fmt(s.maxDewPoint, 1));
    case 'cold':
      return d.cold(fmt(s.coldestHour, 1), fmt(s.frostDays, 0));
    case 'rain':
      return d.rain(fmt(s.wettestMonth, 1), fmt(s.soilWetness, 2));
    case 'water':
      return d.water(fmt(s.annualPrecip, 0));
    case 'snow':
      return d.snow(fmt(s.maxSnow, 0));
    case 'wind':
      return d.wind(fmt(s.meanWind, 1));
    case 'solar':
      return d.solar(fmt(s.solar, 1));
    case 'trend':
      return d.trend(fmtSigned(tr.heatPerDecade, 2), tr.heatSignificant, fmtSigned(tr.precipPctPerDecade, 1), tr.precipSignificant);
  }
}

export default function SiteScorePanel() {
  const t = useT();
  const { siteType, setSiteType, siteRing, siteClosed, siteDrawing, setSiteRing, setSiteDrawing, place } = useStore();
  const [ev, setEv] = useState<EvalState>({ status: 'idle' });
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);
  const type = siteType ?? 'hospital';

  const ready = siteClosed && siteRing.length >= 3;
  const box = ready ? bboxOf(siteRing) : null;
  const tooBig = !!box && (box.latMax - box.latMin > 10 || box.lonMax - box.lonMin > 10);
  const samples = useMemo(() => (ready && !tooBig ? samplePoints(siteRing) : []), [ready, tooBig, siteRing]);
  const area = ready ? areaKm2(siteRing) : 0;

  const evaluate = async () => {
    setEv({ status: 'loading', done: 0, total: samples.length });
    try {
      let done = 0;
      const loaded = await Promise.all(
        samples.map(async ([lon, lat]) => {
          const l = await loadPoint({ lat, lon, params: ALL_CODES, start: FIRST_YEAR, end: END_YEAR });
          done++;
          setEv((e) => ({ ...e, done }));
          return l;
        }),
      );
      const stats = combineStats(loaded.map((l) => climateStats(l.data)));
      setEv({ status: 'ready', stats, trend: trendInfo(loaded[0].data), provenance: [...new Set(loaded.map((l) => l.provenance))] });
    } catch (e) {
      setEv({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  };

  // (re)evaluate whenever a new closed polygon appears
  const ringKey = ready && !tooBig ? JSON.stringify(siteRing) : '';
  useEffect(() => {
    if (ringKey) void evaluate();
    else setEv({ status: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringKey]);

  const result = ev.status === 'ready' && ev.stats && ev.trend ? scoreSite(ev.stats.mean, ev.trend, type) : null;

  const startDrawing = () => {
    setSiteRing([], false);
    setSiteDrawing(true);
  };
  const square = () => {
    const dLat = 10 / 111.32;
    const dLon = 10 / (111.32 * Math.cos((place.lat * Math.PI) / 180));
    setSiteDrawing(false);
    setSiteRing(
      [
        [place.lon - dLon, place.lat - dLat],
        [place.lon + dLon, place.lat - dLat],
        [place.lon + dLon, place.lat + dLat],
        [place.lon - dLon, place.lat + dLat],
      ].map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4] as [number, number]),
      true,
    );
  };
  const btn = 'inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[13px] hover:border-accent disabled:opacity-40';

  return (
    <section ref={panelRef} className="panel scroll-mt-20 space-y-4 p-4" aria-labelledby="site-title" data-tour="site-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="site-title" className="font-semibold">
            {t.site.title}
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-2">{t.site.intro}</p>
        </div>
        <button type="button" onClick={() => setSiteType(null)} className="shrink-0 text-[13px] text-ink-3 hover:text-ink-1" aria-label={t.common.close}>
          ✕
        </button>
      </div>

      <div role="radiogroup" aria-label={t.site.typeLabel} className="flex flex-wrap gap-1.5">
        {BUILDING_TYPES.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={type === b}
            onClick={() => setSiteType(b)}
            className={`rounded-full border px-3 py-1 text-[13px] ${type === b ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-2 hover:text-ink-1'}`}
          >
            {t.site.types[b]}
          </button>
        ))}
      </div>

      {/* drawing controls */}
      {siteDrawing ? (
        <div className="space-y-2 rounded-lg border border-accent/60 bg-surface-2 p-3" role="status">
          <p className="text-[13px] text-ink-1">{t.site.drawing(siteRing.length)}</p>
          <p className="text-[12px] text-ink-3">{t.site.zoomTip}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn}
              disabled={siteRing.length < 3}
              onClick={() => {
                setSiteRing(siteRing, true);
                setSiteDrawing(false);
              }}
            >
              ✓ {t.site.finish}
            </button>
            <button type="button" className={btn} disabled={!siteRing.length} onClick={() => setSiteRing(siteRing.slice(0, -1), false)}>
              ↶ {t.site.undo}
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => {
                setSiteDrawing(false);
                setSiteRing([], false);
              }}
            >
              {t.site.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={startDrawing} data-tour="site-draw">
            <Icon name="pin" size={15} /> {ready ? t.site.redraw : t.site.draw}
          </button>
          <button type="button" className={btn} onClick={square}>
            ▢ {t.site.useSquare}
          </button>
          {ready && (
            <button type="button" className={btn} onClick={() => setSiteRing([], false)}>
              {t.site.clear}
            </button>
          )}
        </div>
      )}

      {ready && !tooBig && (
        <p className="num text-[12px] text-ink-3">
          {t.site.areaInfo(fmt(area, area < 100 ? 1 : 0), samples.length)}
          {area < 2500 && <span className="mt-1 block font-sans text-ink-3">{t.site.smallArea}</span>}
        </p>
      )}
      {tooBig && (
        <p role="alert" className="text-[13px] text-stamp-sug">
          {t.site.tooBig}
        </p>
      )}

      {ev.status === 'loading' && (
        <div aria-busy="true" className="space-y-2">
          <p className="text-[13px] text-ink-2">{t.site.evaluating(ev.done ?? 0, ev.total ?? 0)}</p>
          <div className="skeleton h-32" />
        </div>
      )}
      {ev.status === 'error' && (
        <div role="alert" className="space-y-2 text-[13px]">
          <p className="text-stamp-sug">{t.site.error}</p>
          <p className="num text-[11px] text-ink-3">{ev.error}</p>
          <button type="button" className={btn} onClick={() => void evaluate()}>
            {t.common.retry}
          </button>
        </div>
      )}

      {result && ev.stats && ev.trend && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface-2 p-3">
            <Gauge value={result.total} />
            <div className="min-w-0 flex-1">
              <div className="eyebrow">{t.site.scoreFor(t.site.types[type])}</div>
              <div className="mt-1 text-lg font-semibold text-ink-1">
                {t.site.bands[result.band]} <span className="num text-[13px] font-normal text-ink-3">({result.total} {t.site.outOf})</span>
              </div>
              <div className="mt-2 text-[13px] text-ink-2">
                {result.concerns.length ? (
                  <>
                    <span className="text-ink-3">{t.site.concerns}: </span>
                    {result.concerns
                      .slice(0, 3)
                      .map((f) => t.site.factors[f].name)
                      .join(' · ')}
                  </>
                ) : (
                  t.site.noConcerns
                )}
              </div>
              {result.strengths.length > 0 && (
                <div className="text-[13px] text-ink-2">
                  <span className="text-ink-3">{t.site.strengths}: </span>
                  {result.strengths.map((f) => t.site.factors[f].name).join(' · ')}
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="eyebrow mb-2">{t.site.breakdown}</h4>
            <ul className="space-y-2.5">
              {FACTORS.filter((f) => WEIGHTS[type][f] > 0)
                .sort((a, b) => WEIGHTS[type][b] - WEIGHTS[type][a])
                .map((f) => {
                  const v = result.sub[f];
                  const concern = result.concerns.includes(f);
                  return (
                    <li key={f}>
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="font-medium text-ink-1">
                          {concern && <Icon name="warning" size={13} className="mr-1 inline -translate-y-px text-stamp-sug" />}
                          {t.site.factors[f].name} <span className="text-[11px] font-normal text-ink-3">· {t.site.weight(Math.round(WEIGHTS[type][f] * 100))}</span>
                        </span>
                        <span className="num text-ink-1">{Number.isFinite(v) ? Math.round(v) : '—'}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-3" aria-hidden="true">
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Number.isFinite(v) ? v : 0}%`, opacity: concern ? 0.55 : 1 }} />
                      </div>
                      <p className="num mt-1 text-[11px] text-ink-3">{detailLine(f, ev.stats!.mean, ev.trend!, t)}</p>
                      <p className="text-[11px] text-ink-3">{t.site.factors[f].why}</p>
                    </li>
                  );
                })}
            </ul>
            {samples.length > 1 && (
              <p className="num mt-2 text-[11px] text-ink-3">
                {t.site.varies} {t.site.detail.heat(`${fmt(ev.stats.min.hottestHour, 1)}–${fmt(ev.stats.max.hottestHour, 1)}`, `${fmt(ev.stats.min.maxDewPoint, 1)}–${fmt(ev.stats.max.maxDewPoint, 1)}`)}
              </p>
            )}
            <p className="mt-2 text-[11px] text-ink-3">
              {ev.provenance?.map((p) => t.provenance[p]).join(' · ')} · NASA POWER {END_YEAR - 29}–{END_YEAR}
            </p>
          </div>

          <p className="text-[12px] text-ink-3">{t.site.method}</p>
        </div>
      )}

      <div className="rounded-lg border border-[color-mix(in_srgb,var(--stamp-sug)_50%,var(--line))] p-3 text-[12px] text-ink-2">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink-1">
          <Icon name="warning" size={14} className="text-stamp-sug" /> {t.site.caveatTitle}
        </div>
        <ul className="list-disc space-y-0.5 pl-4">
          {t.site.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
