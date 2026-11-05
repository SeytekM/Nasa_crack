import { ALL_CODES, CATALOG, THEMES, type VarCode } from '../../data/catalog';
import { useT } from '../../content/i18n';

/** Variables grouped by theme; each variable appears under its first theme. */
export function VariablePicker({ value, onChange, id = 'var-picker' }: { value: VarCode; onChange: (v: VarCode) => void; id?: string }) {
  const t = useT();
  return (
    <div className="space-y-2" data-tour="variable-picker">
      <label htmlFor={id} className="sr-only">
        {t.explore.variableHeading}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as VarCode)}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-ink-1 sm:hidden"
      >
        {THEMES.map((th) => (
          <optgroup key={th} label={t.themes[th].label}>
            {ALL_CODES.filter((c) => CATALOG[c].themes[0] === th).map((c) => (
              <option key={c} value={c}>
                {t.vars[c].name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="hidden space-y-2 sm:block" role="radiogroup" aria-label={t.explore.variableHeading}>
        {THEMES.map((th) => (
          <div key={th} className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow w-28 shrink-0">{t.themes[th].label}</span>
            {ALL_CODES.filter((c) => CATALOG[c].themes[0] === th).map((c) => {
              const active = c === value;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(c)}
                  className={`rounded-full border px-2.5 py-1 text-[13px] transition-colors ${
                    active ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink-1'
                  }`}
                >
                  {t.vars[c].name}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
