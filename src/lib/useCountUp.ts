import { useEffect, useState } from 'react';

/** Animate a number from 0 to `target` (400 ms); instant with prefers-reduced-motion. */
export function useCountUp(target: number, duration = 400): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (!Number.isFinite(target) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setV(target * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}
