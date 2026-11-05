/** Our own mark: a globe inside a magnifying glass with a rising trend line. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="13" cy="13" r="9.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <path d="M3.8 13h18.4M13 3.6c2.6 2.6 3.8 5.8 3.8 9.4s-1.2 6.8-3.8 9.4c-2.6-2.6-3.8-5.8-3.8-9.4s1.2-6.8 3.8-9.4Z" fill="none" stroke="var(--accent)" strokeOpacity=".45" strokeWidth="1.2" />
      <path d="M7 17.5l4-3 3 1.8 5-5" fill="none" stroke="var(--series-trend)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.2 20.2 28 28" stroke="var(--ink-2)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
