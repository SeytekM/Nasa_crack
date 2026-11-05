import { useId, useState, type ReactNode } from 'react';
import { useT, type GlossaryId } from '../content/i18n';

/** A scientific term with an accessible glossary tooltip (hover or keyboard focus). */
export function Term({ id, children }: { id: GlossaryId; children?: ReactNode }) {
  const t = useT();
  const entry = t.glossary[id];
  const tipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="cursor-help border-b border-dotted border-ink-3 text-inherit leading-tight hover:border-accent focus-visible:border-accent"
        aria-describedby={tipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {children ?? entry.term}
      </button>
      <span
        role="tooltip"
        id={tipId}
        className={`pointer-events-none absolute left-0 top-full z-50 mt-2 w-72 max-w-[80vw] whitespace-normal rounded-lg border border-line-strong bg-surface-3 p-3 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-ink-1 shadow-panel sm:left-1/2 sm:-translate-x-1/2 ${
          open ? 'block' : 'hidden'
        }`}
      >
        <strong className="mb-1 block text-ink-1">{entry.term}</strong>
        <span className="text-ink-2">{entry.def}</span>
      </span>
    </span>
  );
}
