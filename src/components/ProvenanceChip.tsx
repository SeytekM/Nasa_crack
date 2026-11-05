import type { Loaded, PointDataset, RegionalDataset } from '../data/types';
import { useT } from '../content/i18n';
import { relativeTime } from '../lib/format';

const DOT: Record<string, string> = { live: '#3fb88f', cached: '#5cc8ff', bundled: '#e9c46a', uploaded: '#a36fe0' };

export function ProvenanceChip({ loaded }: { loaded: Loaded<PointDataset | RegionalDataset> | { provenance: 'uploaded'; data?: undefined; fallbackReason?: string } }) {
  const t = useT();
  const p = loaded.provenance;
  const title = [t.provenance.describe[p], loaded.data?.fetchedAt ? t.provenance.fetched(relativeTime(loaded.data.fetchedAt)) : '', loaded.fallbackReason ? t.provenance.fallback(loaded.fallbackReason) : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 mono text-[10px] tracking-[0.12em] text-ink-2" title={title}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[p] }} aria-hidden="true" />
      <span className="sr-only">{t.provenance.label}: </span>
      {t.provenance[p]}
      {loaded.fallbackReason && <span aria-hidden="true">!</span>}
    </span>
  );
}
