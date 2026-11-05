import { CATALOG, type VarCode } from '../../data/catalog';
import { useT } from '../../content/i18n';
import { Term } from '../../components/Term';
import { Icon } from '../../components/Icon';

export function VariableCard({ code }: { code: VarCode }) {
  const t = useT();
  const meta = CATALOG[code];
  const v = t.vars[code];
  const src = t.sources[meta.source];
  return (
    <article className="panel p-4 sm:p-5" aria-labelledby={`var-${code}`} data-tour="variable-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`var-${code}`} className="text-lg font-semibold">
          {v.name}
        </h3>
        <span className="mono text-[11px] text-ink-3">
          {code} · {meta.units}
        </span>
      </div>
      <p className="mt-1 text-ink-2">{v.definition}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="eyebrow mb-1">{t.explore.whyChange}</div>
          <p className="text-[14px] text-ink-2">{v.why}</p>
        </div>
        <div>
          <div className="eyebrow mb-1">{t.explore.source}</div>
          <p className="text-[14px] text-ink-2">
            <span className="mr-1 inline-block rounded border border-line px-1.5 py-px mono text-[10px] uppercase tracking-wider text-ink-1">
              {meta.source === 'srb-ceres' ? src.short : <Term id="reanalysis">{src.short}</Term>}
            </span>
            {src.detail}
          </p>
        </div>
      </div>
      {meta.homogeneousFrom && (
        <p className="mt-3 flex gap-2 text-[13px] text-ink-2">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-stamp-sug" />
          {t.solarStep}
        </p>
      )}
    </article>
  );
}
