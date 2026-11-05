// Dev helper: print trend summaries for every bundled preset (used to write Case Files honestly).
import { readFileSync } from 'node:fs';
import { ALL_CODES, CATALOG, defaultStartYear } from '../../src/data/catalog';
import { pointRecords } from '../../src/data/adapters';
import type { PointDataset } from '../../src/data/types';
import { analyzeMonthly, sliceYears } from '../../src/stats';
const ids = process.argv.slice(2);
for (const id of ids) {
  const d = JSON.parse(readFileSync(`public/data/demo/points/${id}.json`, 'utf8')) as PointDataset;
  console.log(`=== ${id} (${d.lat}, ${d.lon}) elev ${d.elevation}`);
  for (const code of ALL_CODES) {
    const recs = sliceYears(pointRecords(d, code), defaultStartYear(code), d.end);
    const a = analyzeMonthly(recs, CATALOG[code].agg).trend;
    const y = a.yearsToSignificance;
    console.log(`${a.warnings.includes("possible-step") ? "STEP@" + a.step?.breakX + " dBIC=" + a.step?.deltaBic.toFixed(1) + " " : ""}${code.padEnd(18)} ${a.xStart}-${a.xEnd} slope/dec=${a.slopePerDecade.toFixed(4).padStart(9)} CI=[${a.slopePerDecadeCi.map((v) => v.toFixed(3)).join(',')}] p=${a.p.toExponential(2)} mk=${a.mk.p.toExponential(2)} r1=${a.adj.r1.toFixed(2)} ${a.verdict}${a.agreement !== 'agree' ? ' !' + a.agreement : ''}${y ? ' yts=' + Math.round(y.year) : ''} total=${a.totalChange.toFixed(2)} snr=${a.signalToNoise.toFixed(2)}`);
  }
}
