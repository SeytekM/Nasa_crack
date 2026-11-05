import type { Verdict } from '../stats/analyze';
import { useT } from '../content/i18n';

const GLYPH: Record<Verdict, string> = { significant: '✓', suggestive: '~', 'not-significant': '?', insufficient: '∅' };

/** Verdict stamp: shape (double / dashed / dotted border) + glyph + text, never colour alone. */
export function Stamp({ verdict, size = 'md', animate = true }: { verdict: Verdict; size?: 'sm' | 'md' | 'lg'; animate?: boolean }) {
  const t = useT();
  const fs = size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-[10px]' : 'text-sm';
  return (
    <span className={`stamp stamp-${verdict} ${fs} ${animate ? 'stamp-land' : ''}`} role="status" aria-label={`Verdict: ${t.verdict.label[verdict]}`}>
      <span aria-hidden="true">{GLYPH[verdict]}</span>
      {t.verdict.label[verdict]}
    </span>
  );
}
