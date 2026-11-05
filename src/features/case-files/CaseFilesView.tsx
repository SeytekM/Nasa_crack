import { useEffect, useMemo } from 'react';
import { CASES, type CaseDef, type Scene } from '../../content/cases';
import { CASE_IMAGES } from '../../content/caseImages';
import { findPreset } from '../../content/places';
import { useT } from '../../content/i18n';
import { Icon } from '../../components/Icon';
import { pointKey, useStore } from '../../state/store';
import type { PointDataset } from '../../data/types';
import type { Verdict } from '../../stats';
import { ExploreView } from '../explore/ExploreView';
import CompareView from '../compare/CompareView';
import { TimeMachine } from '../time-machine/TimeMachine';
import { makeFacts } from './facts';

function placeRef(id: string) {
  const p = findPreset(id)!;
  return { lat: p.lat, lon: p.lon, name: p.name };
}

/** Push a scene into the global store in one update (no intermediate states). */
function applyScene(scene: Scene) {
  if (scene.kind === 'explore') {
    useStore.setState({
      place: placeRef(scene.place),
      varCode: scene.varCode,
      period: scene.period ?? null,
      basis: 'annual',
      anomalies: true,
      mapRegion: scene.mapRegion ?? null,
      scanOpen: !!scene.scan,
      wizardOpen: false,
    });
  } else if (scene.kind === 'compare') {
    useStore.setState({ compareA: placeRef(scene.a), compareB: placeRef(scene.b), varCode: scene.varCode, period: null, basis: 'annual', anomalies: true, scanOpen: false, mapRegion: null });
  } else {
    useStore.setState({ scanOpen: false, mapRegion: null });
  }
}

function useHighlight(selector: string | undefined, dep: unknown) {
  useEffect(() => {
    if (!selector) return;
    let el: Element | null = null;
    let tries = 0;
    let timer = 0;
    const find = () => {
      el = document.querySelector(`[data-tour="${selector}"]`);
      if (el) {
        el.classList.add('tour-highlight');
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      } else if (tries++ < 40) timer = window.setTimeout(find, 100);
    };
    timer = window.setTimeout(find, 150);
    return () => {
      window.clearTimeout(timer);
      (el as Element | null)?.classList.remove('tour-highlight');
    };
  }, [selector, dep]);
}

function TourCard({ def, step, side }: { def: CaseDef; step: number; side: 'left' | 'right' }) {
  const t = useT();
  const { setCaseStep, openCase, points } = useStore();
  const text = t.tours[def.id];
  const n = def.steps.length;
  const facts = useMemo(() => {
    const data: Record<string, PointDataset | undefined> = {};
    for (const id of def.places) {
      const p = findPreset(id);
      if (p) data[id] = points[pointKey(p)]?.loaded?.data;
    }
    return makeFacts(data);
  }, [def, points]);
  const v = (x: Verdict) => t.verdict.label[x].toUpperCase();
  const last = step === n - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && step < n - 1) setCaseStep(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) setCaseStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, n, setCaseStep]);

  return (
    <aside
      className={`fixed bottom-3 left-3 right-3 z-[70] max-h-[46vh] overflow-y-auto rounded-2xl border border-line-strong bg-surface-1 p-4 shadow-panel sm:w-[440px] sm:p-5 ${side === 'right' ? 'sm:left-auto' : 'sm:right-auto'}`}
      aria-live="polite"
      aria-label={text.title}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="eyebrow">
          {text.title} · {t.cases.step(step + 1, n)}
        </span>
        <button type="button" onClick={() => openCase(null)} className="text-[12px] text-ink-3 hover:text-ink-1">
          {t.cases.exit} ✕
        </button>
      </div>
      <div className="mb-2 flex gap-1" aria-hidden="true">
        {def.steps.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-surface-3'}`} />
        ))}
      </div>
      <h2 className="text-lg font-semibold">{text.steps[step].title}</h2>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{text.steps[step].body(facts, v)}</p>
      {last && (
        <p className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--stamp-sig)_40%,var(--line))] p-2 text-[13px] text-ink-1">
          <span className="eyebrow mr-1">{t.cases.lesson}:</span> {text.lesson}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <button type="button" disabled={step === 0} onClick={() => setCaseStep(step - 1)} className="rounded-md px-3 py-1.5 text-ink-2 hover:text-ink-1 disabled:opacity-30">
          ← {t.common.back}
        </button>
        <span className="hidden text-[11px] text-ink-3 sm:inline">{t.cases.keys}</span>
        {last ? (
          <button type="button" onClick={() => openCase(null)} className="rounded-md bg-accent px-4 py-1.5 text-accent-ink">
            {t.cases.finish} ✓
          </button>
        ) : (
          <button type="button" onClick={() => setCaseStep(step + 1)} className="rounded-md bg-accent px-4 py-1.5 text-accent-ink">
            {t.common.next} →
          </button>
        )}
      </div>
    </aside>
  );
}

function CaseList() {
  const t = useT();
  const openCase = useStore((s) => s.openCase);
  return (
    <div className="mx-auto max-w-6xl px-3 pb-12 sm:px-5">
      <div className="eyebrow">{t.nav.cases}</div>
      <h1 className="text-3xl font-semibold">{t.cases.title}</h1>
      <p className="mt-1 max-w-2xl text-ink-2">{t.cases.intro}</p>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CASES.map((c, i) => {
          const tx = t.tours[c.id];
          return (
            <li key={c.id} className="group relative">
              <div className="absolute -top-3 left-4 h-6 w-28 rounded-t-lg bg-folder" aria-hidden="true" />
              <button
                type="button"
                onClick={() => openCase(c.id, 0)}
                className="relative flex h-full w-full flex-col rounded-xl rounded-tl-none border border-[color-mix(in_srgb,var(--folder)_70%,var(--line))] bg-[color-mix(in_srgb,var(--folder)_22%,var(--surface-1))] p-5 text-left transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
              >
                <span className="mono text-[11px] tracking-[0.16em] text-folder-ink">{t.cases.caseNo(i + 1)}</span>
                <span className="mt-1 text-xl font-semibold text-ink-1">{tx.title}</span>
                <span className="text-[13px] text-ink-2">{tx.subtitle}</span>
                <span className="mt-3 text-[14px] text-ink-2">
                  <span className="eyebrow mr-1">{t.cases.lesson}:</span>
                  {tx.lesson}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent">
                  <Icon name="folder" size={15} /> {t.cases.open} · {c.steps.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function CaseFilesView() {
  const t = useT();
  const { caseId, caseStep, ensurePoint } = useStore();
  const def = CASES.find((c) => c.id === caseId);
  const step = def ? Math.min(caseStep, def.steps.length - 1) : 0;
  const scene = def?.steps[step];

  useEffect(() => {
    if (!def) return;
    for (const id of def.places) void ensurePoint(placeRef(id));
  }, [def, ensurePoint]);

  useEffect(() => {
    if (scene) applyScene(scene);
  }, [scene]);

  useEffect(
    () => () => {
      useStore.setState({ scanOpen: false, mapRegion: null });
    },
    [],
  );

  useHighlight(scene?.highlight, `${caseId}-${step}`);

  if (!def || !scene) return <CaseList />;
  const imageSet = scene.kind === 'time-machine' ? CASE_IMAGES.find((c) => c.id === scene.imageSet) : undefined;
  return (
    <div className="pb-[48vh] sm:pb-40">
      {scene.kind === 'explore' && <ExploreView />}
      {scene.kind === 'compare' && <CompareView />}
      {scene.kind === 'time-machine' && imageSet && (
        <div className="mx-auto max-w-5xl px-3 sm:px-5">
          <div className="eyebrow">{t.tours[def.id].title}</div>
          <h1 className="mb-3 text-2xl font-semibold">{t.timeMachine.title}</h1>
          <TimeMachine bbox={imageSet.bbox} dates={imageSet.dates} caseId={imageSet.id} />
        </div>
      )}
      <TourCard def={def} step={step} side={scene.highlight === 'map' || scene.highlight === 'time-machine' ? 'right' : 'left'} />
    </div>
  );
}
