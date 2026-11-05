import { useEffect, useMemo, useState } from 'react';
import type { Feature, FeatureCollection } from 'geojson';
import { ALL_CODES, CATALOG, type VarCode } from '../../data/catalog';
import { loadRegional } from '../../data/loader';
import { clampBBox, FIRST_YEAR } from '../../data/power';
import type { BBox, Loaded, RegionalDataset } from '../../data/types';
import { useT } from '../../content/i18n';
import { TREND_REGIONS } from '../../content/places';
import { Term } from '../../components/Term';
import { Icon } from '../../components/Icon';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { Sparkline } from '../../components/Sparkline';
import { fmt, fmtLatLon, fmtPEq, fmtSigned, withUnits } from '../../lib/format';
import { DIVERGING, divergingColor, familyOf } from '../../lib/palette';
import { annualAggregate, sliceYears } from '../../stats';
import { regionalCellRecords } from '../../data/adapters';
import { END_YEAR, effectivePeriod, useStore } from '../../state/store';
import { analysisWorker } from '../../workers/client';
import type { TrendMapResult } from '../../workers/analysisCore';
import type { MapOverlay } from '../map/GlobeMap';

function hereBBox(lat: number, lon: number): BBox {
  return clampBBox({ latMin: Math.floor(lat) - 5, latMax: Math.floor(lat) + 5, lonMin: Math.floor(lon) - 5, lonMax: Math.floor(lon) + 5 });
}

export function buildOverlay(res: TrendMapResult, param: string, bbox: BBox): MapOverlay {
  const hl = res.dLat / 2;
  const ho = res.dLon / 2;
  const cells: Feature[] = res.cells
    .filter((c) => Number.isFinite(c.sen))
    .map((c) => ({
      type: 'Feature',
      properties: { idx: c.idx, color: divergingColor(c.sen, res.scaleMax, param), sig: c.significant },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [c.lon - ho, c.lat - hl],
            [c.lon + ho, c.lat - hl],
            [c.lon + ho, c.lat + hl],
            [c.lon - ho, c.lat + hl],
            [c.lon - ho, c.lat - hl],
          ],
        ],
      },
    }));
  const stipple: Feature[] = res.cells
    .filter((c) => c.significant)
    .map((c) => ({ type: 'Feature', properties: { idx: c.idx }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } }));
  return {
    cells: { type: 'FeatureCollection', features: cells } as FeatureCollection,
    stipple: { type: 'FeatureCollection', features: stipple } as FeatureCollection,
    bounds: [
      [bbox.lonMin, bbox.latMin],
      [bbox.lonMax, bbox.latMax],
    ],
  };
}

export function Legend({ param, max }: { param: string; max: number }) {
  const t = useT();
  const meta = (CATALOG as Record<string, { annualUnits: string }>)[param];
  const stops = DIVERGING[familyOf(param)];
  const inverted = param === 'FROST_DAYS';
  const grad = `linear-gradient(90deg, ${(inverted ? [...stops].reverse() : stops).join(',')})`;
  return (
    <div className="space-y-1.5" aria-label={t.trendMap.legendSlope(meta?.annualUnits ?? '')}>
      <div className="text-[12px] text-ink-2">{t.trendMap.legendSlope(meta?.annualUnits ?? '')}</div>
      <div className="h-3 rounded" style={{ background: grad }} />
      <div className="num flex justify-between text-[11px] text-ink-3">
        <span>{fmtSigned(-max)}</span>
        <span>0</span>
        <span>{fmtSigned(max)}</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ink-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-black" aria-hidden="true" />
        {t.trendMap.legendSig}
      </div>
    </div>
  );
}

export default function TrendMapPanel({ onOverlay }: { onOverlay: (o: MapOverlay | null, onCell?: (i: number) => void) => void }) {
  const t = useT();
  const { mapRegion, setMapRegion, place, varCode, period, setPlace, setVar } = useStore();
  const region = TREND_REGIONS.find((r) => r.id === mapRegion);
  const params: VarCode[] = region ? region.params : ALL_CODES;
  const [param, setParam] = useState<VarCode>(params.includes(varCode) ? varCode : params[0]);
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; loaded?: Loaded<RegionalDataset>; res?: TrendMapResult; error?: string }>({ status: 'idle' });
  const [cell, setCell] = useState<number | null>(null);
  const bbox = useMemo(() => region?.bbox ?? hereBBox(place.lat, place.lon), [region, place.lat, place.lon]);
  const p = effectivePeriod(param, period);

  useEffect(() => {
    if (!params.includes(param)) setParam(params[0]);
  }, [params, param]);

  useEffect(() => () => onOverlay(null), [onOverlay]);

  const run = async () => {
    setState({ status: 'loading' });
    setCell(null);
    try {
      const loaded = await loadRegional({ bbox, param, start: FIRST_YEAR, end: END_YEAR });
      const res = await analysisWorker().trendMap({ data: loaded.data, period: p });
      setState({ status: 'ready', loaded, res });
      onOverlay(buildOverlay(res, param, loaded.data.bbox), (idx) => setCell(idx));
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      onOverlay(null);
    }
  };

  // Bundled regions are instant and offline: render them straight away.
  useEffect(() => {
    if (region) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.id, param, p[0], p[1]]);

  const selected = state.res && cell !== null ? state.res.cells[cell] : null;
  const cellSpark = useMemo(() => {
    if (!selected || !state.loaded) return [];
    const agg = CATALOG[param].agg;
    return annualAggregate(sliceYears(regionalCellRecords(state.loaded.data, selected.idx), p[0], p[1]), agg)
      .filter((a) => Number.isFinite(a.value))
      .map((a) => [a.year, a.value] as [number, number]);
  }, [selected, state.loaded, param, p]);

  return (
    <section className="panel space-y-3 p-4" aria-labelledby="tm-title" data-tour="trendmap-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 id="tm-title" className="font-semibold">
          {t.trendMap.title}
        </h3>
        <button type="button" onClick={() => setMapRegion(null)} className="text-[13px] text-ink-3 hover:text-ink-1">
          {t.trendMap.hide}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] text-ink-3">
          {t.trendMap.regionLabel}
          <select value={mapRegion ?? 'here'} onChange={(e) => setMapRegion(e.target.value)} className="mt-0.5 block w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[14px] text-ink-1">
            <option value="here">{t.trendMap.current}</option>
            {TREND_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-ink-3">
          {t.trendMap.variable}
          <select value={param} onChange={(e) => setParam(e.target.value as VarCode)} className="mt-0.5 block w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[14px] text-ink-1">
            {params.map((c) => (
              <option key={c} value={c}>
                {t.vars[c].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void run()} disabled={state.status === 'loading'} className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-accent-ink disabled:opacity-50">
          <Icon name="map" size={16} /> {t.trendMap.run}
        </button>
        <span className="num text-[12px] text-ink-3">
          {p[0]}–{p[1]} · {fmt(bbox.latMax - bbox.latMin, 0)}° × {fmt(bbox.lonMax - bbox.lonMin, 0)}°
        </span>
        {state.loaded && <ProvenanceChip loaded={state.loaded} />}
      </div>
      {state.status === 'loading' && <div className="skeleton h-16" aria-busy="true" />}
      {state.status === 'error' && (
        <p role="alert" className="text-[13px] text-stamp-sug">
          {state.error} —{' '}
          <button type="button" className="underline" onClick={() => void run()}>
            {t.common.retry}
          </button>
        </p>
      )}
      {state.status === 'ready' && state.res && (
        <>
          <Legend param={param} max={state.res.scaleMax} />
          <p className="num text-[13px] text-ink-1" role="status">
            {t.trendMap.summary(state.res.nPos, state.res.nNeg, state.res.nTests)}
          </p>
          {state.res.nSignificant === 0 && <p className="text-[13px] text-ink-2">{t.trendMap.noneSig}</p>}
          <p className="text-[12px] text-ink-3">
            <Term id="q-value">FDR</Term> — {t.trendMap.fdrHelp}
          </p>
          <p className="text-[12px] text-ink-3">{t.trendMap.clickCell}</p>
          {selected && (
            <div className="rounded-lg border border-line-strong bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="num text-[12px] text-ink-2">{fmtLatLon(selected.lat, selected.lon)}</span>
                <span className="num text-[12px] text-ink-2">
                  Sen {withUnits(fmtSigned(selected.sen), CATALOG[param].annualUnits)} {t.common.perDecade} · {fmtPEq(selected.p)}
                  {selected.significant ? ' · FDR ✓' : ''}
                </span>
              </div>
              <Sparkline points={cellSpark} color={divergingColor(selected.sen, state.res.scaleMax, param)} width={300} height={48} label={t.scan.sparkLabel(t.vars[param].name)} />
              {selected.step && <p className="mt-1 text-[12px] text-ink-2">⚠ {t.warnings['possible-step']}</p>}
              <button
                type="button"
                className="mt-1 text-[13px] text-accent hover:underline"
                onClick={() => {
                  setVar(param);
                  setPlace({ lat: selected.lat, lon: selected.lon });
                }}
              >
                {t.scan.open} →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
