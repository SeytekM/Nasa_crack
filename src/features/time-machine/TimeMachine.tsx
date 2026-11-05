import { useEffect, useRef, useState } from 'react';
import { gibsSnapshotUrl, GIBS_LAYERS } from '../../data/gibs';
import { dataUrl, loadManifest } from '../../data/loader';
import type { BBox } from '../../data/types';
import { useT } from '../../content/i18n';
import { CASE_IMAGES, caseImageFile } from '../../content/caseImages';

export interface TimeMachineProps {
  bbox: BBox;
  dates: [string, string];
  /** Case-image set id → use bundled images when available (offline). */
  caseId?: string;
  editable?: boolean;
}

/** Before/after "curtain" between two GIBS MODIS snapshots. */
export function TimeMachine({ bbox, dates: initial, caseId, editable = false }: TimeMachineProps) {
  const t = useT();
  const [dates, setDates] = useState<[string, string]>(initial);
  const [pos, setPos] = useState(50);
  const [srcs, setSrcs] = useState<[string, string] | null>(null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    (async () => {
      const manifest = await loadManifest();
      const set = caseId ? CASE_IMAGES.find((c) => c.id === caseId) : undefined;
      const resolve = (d: string) => {
        const file = set ? caseImageFile(set.id, d) : null;
        if (file && manifest?.images.some((im) => im.file === file)) return dataUrl(file);
        return gibsSnapshotUrl(bbox, d, { width: 1000 });
      };
      if (alive) setSrcs([resolve(dates[0]), resolve(dates[1])]);
    })();
    return () => {
      alive = false;
    };
  }, [bbox, dates, caseId]);

  const moveTo = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  const aspect = (bbox.lonMax - bbox.lonMin) / (bbox.latMax - bbox.latMin) / Math.cos((((bbox.latMin + bbox.latMax) / 2) * Math.PI) / 180);

  return (
    <div className="space-y-3" data-tour="time-machine">
      {editable && (
        <div className="flex flex-wrap items-end gap-3 text-[13px]">
          {[0, 1].map((i) => (
            <label key={i} className="text-ink-3">
              {i === 0 ? t.timeMachine.before : t.timeMachine.after}
              <input
                type="date"
                min={GIBS_LAYERS.modisTerra.firstDate}
                max={new Date().toISOString().slice(0, 10)}
                value={dates[i]}
                onChange={(e) => e.target.value && setDates((d) => (i === 0 ? [e.target.value, d[1]] : [d[0], e.target.value]))}
                className="num mt-0.5 block rounded-md border border-line bg-surface-2 px-2 py-1 text-ink-1"
              />
            </label>
          ))}
          <p className="max-w-md text-[12px] text-ink-3">{t.timeMachine.tip}</p>
        </div>
      )}
      <div
        ref={box}
        className="relative w-full cursor-ew-resize select-none overflow-hidden rounded-xl border border-line bg-black"
        style={{ aspectRatio: String(Math.max(0.6, Math.min(2.2, aspect))) }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
      >
        {srcs && !failed && (
          <>
            <img src={srcs[1]} alt={t.timeMachine.alt(dates[1])} className="absolute inset-0 h-full w-full object-cover" draggable={false} onError={() => setFailed(true)} />
            <img
              src={srcs[0]}
              alt={t.timeMachine.alt(dates[0])}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              draggable={false}
              onError={() => setFailed(true)}
            />
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(255,255,255,.6)]" style={{ left: `${pos}%` }} />
            <span className="mono absolute left-3 top-3 rounded bg-black/65 px-2 py-0.5 text-[12px] text-white">{dates[0]}</span>
            <span className="mono absolute right-3 top-3 rounded bg-black/65 px-2 py-0.5 text-[12px] text-white">{dates[1]}</span>
          </>
        )}
        {(!srcs || failed) && <div className={`absolute inset-0 grid place-items-center text-ink-3 ${failed ? '' : 'skeleton rounded-none'}`}>{failed ? t.timeMachine.failed : ''}</div>}
      </div>
      <label className="flex items-center gap-3 text-[13px] text-ink-3">
        <span className="shrink-0">{t.timeMachine.slider}</span>
        <input type="range" min={0} max={100} value={Math.round(pos)} onChange={(e) => setPos(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
      </label>
      <p className="text-[12px] text-ink-3">{t.timeMachine.credit}</p>
    </div>
  );
}
