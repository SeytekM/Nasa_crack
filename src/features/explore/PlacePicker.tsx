import { useMemo, useState } from 'react';
import { PRESETS } from '../../content/places';
import { useT } from '../../content/i18n';
import { Icon } from '../../components/Icon';
import type { PlaceRef } from '../../state/url';

/** Parse "42.9, 74.6" or "42.9N 74.6E" style input. */
export function parseLatLon(s: string): { lat: number; lon: number } | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function PlacePicker({ value, onPick, compact = false }: { value: PlaceRef; onPick: (p: PlaceRef) => void; compact?: boolean }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [lat, setLat] = useState(String(value.lat));
  const [lon, setLon] = useState(String(value.lon));
  const [err, setErr] = useState<string | null>(null);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return PRESETS.filter((p) => `${p.name} ${p.country}`.toLowerCase().includes(s)).slice(0, 6);
  }, [q]);
  const coords = parseLatLon(q);

  const submitLatLon = () => {
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      setErr(t.explore.invalidCoords);
      return;
    }
    setErr(null);
    onPick({ lat: la, lon: lo });
  };

  return (
    <div className="space-y-3" data-tour="place-picker">
      <div className="relative">
        <label htmlFor="place-search" className="sr-only">
          {t.explore.searchPlaceholder}
        </label>
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          id="place-search"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (coords) {
                onPick(coords);
                setQ('');
              } else if (matches[0]) {
                onPick({ lat: matches[0].lat, lon: matches[0].lon, name: matches[0].name });
                setQ('');
              }
            }
          }}
          placeholder={t.explore.searchPlaceholder}
          className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-ink-1 placeholder:text-ink-3"
          aria-autocomplete="list"
          aria-controls="place-results"
        />
        {(matches.length > 0 || coords) && (
          <ul id="place-results" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line-strong bg-surface-3 shadow-panel">
            {coords && (
              <li>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-surface-2" onClick={() => (onPick(coords), setQ(''))}>
                  <span className="num">
                    {coords.lat}, {coords.lon}
                  </span>
                </button>
              </li>
            )}
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={false} className="w-full px-3 py-2 text-left hover:bg-surface-2" onClick={() => (onPick({ lat: p.lat, lon: p.lon, name: p.name }), setQ(''))}>
                  {p.name} <span className="text-ink-3">· {p.country}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!compact && (
        <div>
          <div className="eyebrow mb-1.5">{t.explore.presets}</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = Math.abs(p.lat - value.lat) < 1e-3 && Math.abs(p.lon - value.lon) < 1e-3;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick({ lat: p.lat, lon: p.lon, name: p.name })}
                  className={`rounded-full border px-2.5 py-0.5 text-[12px] ${active ? 'border-accent text-ink-1' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink-1'}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitLatLon();
        }}
      >
        <label className="text-[12px] text-ink-3">
          {t.explore.latLabel}
          <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" className="num mt-0.5 block w-24 rounded-md border border-line bg-surface-2 px-2 py-1 text-[14px] text-ink-1" />
        </label>
        <label className="text-[12px] text-ink-3">
          {t.explore.lonLabel}
          <input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" className="num mt-0.5 block w-24 rounded-md border border-line bg-surface-2 px-2 py-1 text-[14px] text-ink-1" />
        </label>
        <button type="submit" className="rounded-md border border-line-strong px-3 py-1 text-[14px] hover:border-accent">
          {t.explore.go}
        </button>
        {err && (
          <p role="alert" className="w-full text-[12px] text-stamp-sug">
            {err}
          </p>
        )}
      </form>
    </div>
  );
}
