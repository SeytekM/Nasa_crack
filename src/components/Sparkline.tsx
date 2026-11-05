/** Tiny inline SVG sparkline with an OLS trend line. */
export function Sparkline({ points, color, width = 160, height = 40, label }: { points: [number, number][]; color: string; width?: number; height?: number; label: string }) {
  const pts = points.filter((p) => Number.isFinite(p[1]));
  if (pts.length < 2) return <svg width={width} height={height} role="img" aria-label={label} />;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const pad = 3;
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (width - 2 * pad);
  const sy = (y: number) => height - pad - ((y - y0) / (y1 - y0)) * (height - 2 * pad);
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  pts.forEach(([x, y]) => {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  });
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <polyline points={pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeLinejoin="round" />
      <line x1={sx(x0)} y1={sy(a + b * x0)} x2={sx(x1)} y2={sy(a + b * x1)} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
