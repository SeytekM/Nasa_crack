import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useT } from '../../content/i18n';
import { PRESETS } from '../../content/places';
import { Icon } from '../../components/Icon';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { fmtLatLon } from '../../lib/format';
import { pointKey, usePointEntry, useStore } from '../../state/store';
import type { PlaceRef } from '../../state/url';
import { AnalysisPanel } from '../analysis/AnalysisPanel';
import { VariableCard } from '../analysis/VariableCard';
import { VariablePicker } from '../analysis/VariablePicker';
import { PlacePicker } from './PlacePicker';
import type { BaseLayer, MapOverlay } from '../map/GlobeMap';

const GlobeMap = lazy(() => import('../map/GlobeMap'));
const Wizard = lazy(() => import('../wizard/Wizard'));
const EvidenceBoard = lazy(() => import('../scan/EvidenceBoard'));
const TrendMapPanel = lazy(() => import('../trend-map/TrendMapPanel'));

export function placeLabel(p: PlaceRef): string {
  if (p.name) return p.name;
  const preset = PRESETS.find((x) => Math.abs(x.lat - p.lat) < 1e-3 && Math.abs(x.lon - p.lon) < 1e-3);
  return preset?.name ?? fmtLatLon(p.lat, p.lon);
}

export function LoadingState({ text }: { text: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-ink-2">{text}</p>
      <div className="skeleton h-28" />
      <div className="skeleton h-[380px]" />
      <div className="skeleton h-48" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const t = useT();
  const setPlace = useStore((s) => s.setPlace);
  return (
    <div role="alert" className="panel border-[color-mix(in_srgb,var(--stamp-sug)_50%,transparent)] p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="warning" className="text-stamp-sug" /> {t.explore.errorTitle}
      </h3>
      <p className="mt-1 text-ink-2">{t.explore.errorBody}</p>
      {message && <p className="num mt-2 text-[12px] text-ink-3">{message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="rounded-md bg-accent px-3 py-1.5 text-accent-ink">
          {t.common.retry}
        </button>
        {PRESETS.slice(0, 4).map((p) => (
          <button key={p.id} type="button" onClick={() => setPlace({ lat: p.lat, lon: p.lon, name: p.name })} className="rounded-md border border-line px-3 py-1.5 text-ink-2 hover:text-ink-1">
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExploreView() {
  const t = useT();
  const { place, setPlace, varCode, setVar, wizardOpen, setWizardOpen, scanOpen, setScanOpen, mapRegion, setMapRegion, ensurePoint } = useStore();
  const entry = usePointEntry(place);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('blueMarble');
  const [overlay, setOverlay] = useState<{ overlay: MapOverlay | null; onCell?: (i: number) => void }>({ overlay: null });
  const name = placeLabel(place);

  useEffect(() => {
    void ensurePoint(place);
  }, [place, ensurePoint]);

  const markers = useMemo(() => [{ lat: place.lat, lon: place.lon, color: '#ffb547', label: name }], [place.lat, place.lon, name]);
  const loaded = entry?.loaded;
  const d = loaded?.data;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 px-3 pb-10 sm:px-5 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
      {/* left: globe + place */}
      <div className="space-y-3 lg:sticky lg:top-[68px] lg:self-start">
        <div className="panel relative h-[42vh] overflow-hidden sm:h-[48vh] lg:h-[56vh]" data-tour="map">
          <Suspense fallback={<div className="skeleton h-full rounded-none" />}>
            <GlobeMap
              center={place}
              markers={markers}
              onPick={(lat, lon) => setPlace({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 })}
              overlay={overlay.overlay}
              onCellClick={overlay.onCell}
              baseLayer={baseLayer}
              ariaLabel={t.explore.clickMap}
              flyKey={pointKey(place)}
            />
          </Suspense>
          <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-lg bg-[color-mix(in_srgb,var(--surface-1)_82%,transparent)] px-3 py-1.5 text-[12px] text-ink-2 backdrop-blur">
            {t.explore.clickMap}
          </div>
          <div className="absolute bottom-3 left-3 flex overflow-hidden rounded-md border border-line bg-surface-1 text-[12px]" role="radiogroup" aria-label={t.explore.mapLayer}>
            {(['blueMarble', 'modis'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={baseLayer === l} onClick={() => setBaseLayer(l)} className={`px-2.5 py-1 ${baseLayer === l ? 'bg-surface-3 text-ink-1' : 'text-ink-3'}`}>
                {l === 'blueMarble' ? t.explore.layerBlueMarble : t.explore.layerModis}
              </button>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <PlacePicker key={pointKey(place)} value={place} onPick={setPlace} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setWizardOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-1 px-3 py-2 hover:border-accent" data-tour="wizard-button">
            <Icon name="spark" /> {t.explore.wizardButton}
          </button>
          <button
            type="button"
            onClick={() => setMapRegion(mapRegion ? null : 'here')}
            aria-pressed={!!mapRegion}
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-1 px-3 py-2 hover:border-accent"
            data-tour="trendmap-button"
          >
            <Icon name="map" /> {t.trendMap.button}
          </button>
        </div>
        {mapRegion && (
          <Suspense fallback={<div className="skeleton h-40" />}>
            <TrendMapPanel onOverlay={(o, onCell) => setOverlay({ overlay: o, onCell })} />
          </Suspense>
        )}
      </div>

      {/* right: analysis */}
      <div className="min-w-0 space-y-4" id="analysis">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">{t.explore.placeHeading}</div>
            <h2 className="truncate text-2xl font-semibold">{name}</h2>
            <p className="num text-[12px] text-ink-3">
              {d ? t.explore.gridNote(fmtLatLon(place.lat, place.lon), d.elevation !== null ? `${Math.round(d.elevation)} m` : '—') : fmtLatLon(place.lat, place.lon)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loaded && <ProvenanceChip loaded={loaded} />}
            <button
              type="button"
              disabled={!loaded}
              onClick={() => setScanOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 font-medium text-accent-ink shadow-glow disabled:opacity-40"
              data-tour="scan-button"
              title={t.explore.scanHint}
            >
              <Icon name="scan" /> {t.explore.scanButton}
            </button>
          </div>
        </header>

        <section className="panel p-4" aria-label={t.explore.variableHeading}>
          <VariablePicker value={varCode} onChange={setVar} />
        </section>

        <VariableCard code={varCode} />

        {entry?.status === 'error' && !loaded && <ErrorState message={entry.error} onRetry={() => void ensurePoint(place, { force: true })} />}
        {(!entry || (entry.status === 'loading' && !loaded)) && <LoadingState text={t.explore.loadingPlace} />}
        {loaded && <AnalysisPanel loaded={loaded} placeName={name} />}
      </div>

      {wizardOpen && (
        <Suspense fallback={null}>
          <Wizard onClose={() => setWizardOpen(false)} />
        </Suspense>
      )}
      {scanOpen && loaded && (
        <Suspense fallback={null}>
          <EvidenceBoard loaded={loaded} placeName={name} onClose={() => setScanOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
