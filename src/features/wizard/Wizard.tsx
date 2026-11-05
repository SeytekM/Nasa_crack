import { useEffect, useMemo, useState } from 'react';
import { THEMES, type Theme } from '../../data/catalog';
import { useT } from '../../content/i18n';
import { classifyTerrain, placeClimate, recommend } from '../../content/rules';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';
import { fmt } from '../../lib/format';
import { END_YEAR, usePointEntry, useStore } from '../../state/store';
import type { PlaceRef } from '../../state/url';
import { PlacePicker } from '../explore/PlacePicker';
import { placeLabel } from '../explore/ExploreView';

type PeriodKey = 'full' | 'recent30' | 'satellite';
const PERIODS: Record<PeriodKey, [number, number] | null> = {
  full: null,
  recent30: [END_YEAR - 29, END_YEAR],
  satellite: [2001, END_YEAR],
};

const THEME_ICON: Record<Theme, string> = { heat: '🌡', water: '💧', snow: '❄', sun: '☀', wind: '🌬' };

export default function Wizard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const store = useStore();
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [place, setPlace] = useState<PlaceRef>(store.place);
  const [period, setPeriodKey] = useState<PeriodKey>('full');
  const entry = usePointEntry(place);
  const { ensurePoint } = store;

  useEffect(() => {
    if (step >= 1) void ensurePoint(place);
  }, [step, place, ensurePoint]);

  const result = useMemo(() => {
    if (!entry?.loaded || !theme) return null;
    const climate = placeClimate(entry.loaded.data);
    const terrain = classifyTerrain(climate);
    return { climate, terrain, leads: recommend(terrain, theme) };
  }, [entry, theme]);

  const investigate = (code: (typeof result & object)['leads'][number]['code']) => {
    store.setPlace(place);
    store.setVar(code);
    store.setPeriod(PERIODS[period]);
    onClose();
    requestAnimationFrame(() => document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const n = 3;
  return (
    <Modal title={t.wizard.title} onClose={onClose} wide>
      {step < n && <p className="eyebrow mb-3">{t.wizard.step(step + 1, n)}</p>}

      {step === 0 && (
        <fieldset>
          <legend className="mb-3 text-lg">{t.wizard.q1}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {THEMES.map((th) => (
              <button
                key={th}
                type="button"
                aria-pressed={theme === th}
                onClick={() => {
                  setTheme(th);
                  setStep(1);
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${theme === th ? 'border-accent bg-surface-3' : 'border-line hover:border-line-strong'}`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {THEME_ICON[th]}
                </span>
                <span className="mt-1 block font-semibold">{t.themes[th].label}</span>
                <span className="block text-[12px] text-ink-3">{t.themes[th].blurb}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <div>
          <h3 className="mb-1 text-lg">{t.wizard.q2}</h3>
          <p className="mb-3 text-[13px] text-ink-3">{t.wizard.q2help}</p>
          <p className="mb-3">
            <Icon name="pin" className="mr-1 inline" size={16} />
            <strong>{placeLabel(place)}</strong>
          </p>
          <PlacePicker key={`${place.lat},${place.lon}`} value={place} onPick={setPlace} />
        </div>
      )}

      {step === 2 && (
        <fieldset>
          <legend className="mb-3 text-lg">{t.wizard.q3}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={period === k}
                onClick={() => {
                  setPeriodKey(k);
                  setStep(3);
                }}
                className={`rounded-xl border p-3 text-left ${period === k ? 'border-accent bg-surface-3' : 'border-line hover:border-line-strong'}`}
              >
                <span className="block font-semibold">{t.wizard.periods[k].label}</span>
                <span className="block text-[12px] text-ink-3">{t.wizard.periods[k].help}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {step === 3 && (
        <div aria-live="polite">
          <h3 className="mb-2 text-lg">{t.wizard.resultTitle}</h3>
          {!result && <div className="skeleton h-40" />}
          {result && (
            <>
              <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3">
                <p className="font-medium">{t.wizard.terrainIs(t.terrain[result.terrain].label)}</p>
                <p className="text-[13px] text-ink-2">{t.terrain[result.terrain].blurb}</p>
                <p className="num mt-1 text-[12px] text-ink-3">
                  {t.wizard.terrainBasis(`${fmt(result.climate.meanT, 1)} °C`, `${fmt(result.climate.precip, 0)} mm/yr`, `${fmt(result.climate.snow, 1)} cm`, `${Math.round(result.climate.elevation)} m`)}
                </p>
              </div>
              <ol className="space-y-2">
                {result.leads.map((l, i) => (
                  <li key={l.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        <span className="mono mr-2 text-ink-3">#{i + 1}</span>
                        {t.vars[l.code].name}
                      </div>
                      <p className="text-[13px] text-ink-2">{l.reason}</p>
                    </div>
                    <button type="button" onClick={() => investigate(l.code)} className="rounded-md bg-accent px-3 py-1.5 text-accent-ink">
                      {t.wizard.investigate}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-between">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-md px-3 py-1.5 text-ink-2 hover:text-ink-1 disabled:opacity-30">
          ← {t.common.back}
        </button>
        {step === 1 && (
          <button type="button" onClick={() => setStep(2)} className="rounded-md bg-accent px-4 py-1.5 text-accent-ink">
            {t.common.next} →
          </button>
        )}
      </div>
    </Modal>
  );
}
