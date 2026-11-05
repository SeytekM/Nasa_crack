/**
 * Case File texts (English). Numbers come from `f(place, variable)`, computed
 * live from the bundled data — never typed in by hand.
 */
import type { CaseId } from '../cases';
import type { FactFn } from '../../features/case-files/facts';
import type { Verdict } from '../../stats';

type V = (v: Verdict) => string;
export interface TourText {
  title: string;
  subtitle: string;
  lesson: string;
  steps: { title: string; body: (f: FactFn, v: V) => string }[];
}

export const tours: Record<CaseId, TourText> = {
  snow: {
    title: 'Snow goes both ways',
    subtitle: 'Tian Shan & the Ili plains, Kazakhstan/Kyrgyzstan',
    lesson: 'One cause can push the same variable in opposite directions.',
    steps: [
      {
        title: 'A map with two colours',
        body: () =>
          'This Trend Map tests snow depth in 357 grid cells around the Tian Shan mountains (1981–2025). Teal means more snow, brown means less. Dots mark cells that stay significant after controlling the False Discovery Rate. The mountain ranges are teal; the plains to the north are brown. Same region, same variable, opposite directions. Why?',
      },
      {
        title: 'Two witnesses, 170 km apart',
        body: (f, v) => {
          const a = f('ili-plains', 'SNODP');
          const b = f('almaty-mountains', 'SNODP');
          return `On the Ili River plains (~1000 m) snow depth changed by ${a.slope} per decade (${v(a.verdict)}). In the mountains above Almaty (~3000 m) it changed by ${b.slope} per decade (${v(b.verdict)}). Both trends pass the test, and they point in opposite directions.`;
        },
      },
      {
        title: 'Clue #1: both places are warming',
        body: (f, v) => {
          const a = f('ili-plains', 'T2M');
          const b = f('almaty-mountains', 'T2M');
          return `Air temperature: plains ${a.slope} per decade (${v(a.verdict)}), mountains ${b.slope} per decade (${v(b.verdict)}). So warming alone does not explain why the mountains gain snow.`;
        },
      },
      {
        title: 'Clue #2: the air holds more water',
        body: (f, v) => {
          const a = f('ili-plains', 'QV2M');
          const b = f('almaty-mountains', 'QV2M');
          return `Specific humidity (actual water vapour): plains ${a.slope} per decade (${v(a.verdict)}), mountains ${b.slope} per decade (${v(b.verdict)}). Warmer air carries more moisture. Where it is still well below freezing — high in the mountains — extra moisture can fall as extra snow. On the milder plains, warming shortens the snow season instead. One cause, two opposite local outcomes.`;
        },
      },
      {
        title: 'Detective’s caution',
        body: (f, v) => {
          const b = f('almaty-mountains', 'PRECTOTCORR');
          return `Mountain precipitation here: ${b.slope} per decade (${v(b.verdict)}). This fits the story, but precipitation in steep terrain is one of the hardest things for a reanalysis to get right. Before publishing, a good detective checks a second, independent witness — e.g. GPM IMERG precipitation exported from NASA Giovanni (see Learn → Bring your own data).`;
        },
      },
    ],
  },
  arctic: {
    title: 'Arctic fever',
    subtitle: 'Longyearbyen, Svalbard (78° N)',
    lesson: 'A strong, clean signal: big change, small noise, every grid cell agrees.',
    steps: [
      {
        title: 'The suspect',
        body: () =>
          'Air temperature at Svalbard from the MERRA-2 reanalysis, 1981–2025. The chart shows anomalies: each month minus its usual value, so the summer–winter cycle is removed and the long-term change is easier to see. Purple dots are yearly means; the orange line is the trend with its 95% confidence band.',
      },
      {
        title: 'The verdict',
        body: (f, v) => {
          const a = f('svalbard', 'T2M');
          return `${a.slope} per decade, about ${a.total} over ${a.from}–${a.to} (${a.p}): ${v(a.verdict)}. That is several times the global-average rate of roughly 0.2 °C per decade reported by the IPCC — the “Arctic amplification”.`;
        },
      },
      {
        title: 'Follow the evidence: snow',
        body: (f, v) => {
          const a = f('svalbard', 'SNODP');
          return `If it is warming, snow should suffer. Snow depth: ${a.slope} per decade (${a.p}) → ${v(a.verdict)}.`;
        },
      },
      {
        title: 'Follow the evidence: frost',
        body: (f, v) => {
          const a = f('svalbard', 'FROST_DAYS');
          return `Frost days: ${a.slope} per decade, about ${a.total} over the record (${a.p}) → ${v(a.verdict)}. Three independent variables tell the same story.`;
        },
      },
      {
        title: 'Is it just one spot?',
        body: () =>
          'The Trend Map tests every grid cell in a 10° × 10° box around Svalbard. Every cell is red, and every cell keeps its dot after the False Discovery Rate correction: the warming is regional, not a quirk of one point.',
      },
    ],
  },
  aral: {
    title: 'The vanished sea',
    subtitle: 'Former Aral Sea, Kazakhstan/Uzbekistan',
    lesson: 'Satellite images, reanalysis and statistics each see different parts of the truth.',
    steps: [
      {
        title: 'Eyewitness: satellites',
        body: () =>
          'MODIS Terra images from NASA GIBS, both in August: 28 Aug 2000 and 10 Aug 2025. Drag the curtain. Most of the sea has turned into desert.',
      },
      {
        title: 'Hotter extremes',
        body: (f, v) => {
          const a = f('aral', 'T2M_MAX');
          return `On the former sea bed, the hottest hour of each month rose by ${a.slope} per decade (${a.p}) → ${v(a.verdict)}.`;
        },
      },
      {
        title: 'Not every variable agrees (yet)',
        body: (f, v) => {
          const a = f('aral', 'T2M');
          return `Mean air temperature: ${a.slope} per decade, ${a.p} → ${v(a.verdict)}. The year-to-year noise is large compared with the trend. ${a.yts ? `If the trend continued with the same noise, it would likely become significant around ${a.yts} — an assumption, not a forecast.` : ''}`;
        },
      },
      {
        title: 'What the model cannot see',
        body: () =>
          'A reanalysis is a model guided by observations — not a camera. In the raw POWER data for this grid cell, land evapotranspiration is exactly zero in every month of 1981–2025, which suggests the model still treats the area as water: its land–water map does not follow the shrinking shoreline. The satellite images catch what the reanalysis misses. Always ask what a dataset can and cannot know.',
      },
      {
        title: 'One p-value is not a map',
        body: () =>
          'Now test the hottest-hour trend in every cell of the Aral basin. After the False Discovery Rate correction no cell keeps its dot: with ~350 tests, individually “significant” cells are what chance alone would produce. A single point can pass while the region as a whole stays unproven.',
      },
    ],
  },
  bishkek: {
    title: 'Home base: Bishkek',
    subtitle: 'Bishkek, Kyrgyzstan',
    lesson: 'A significant p-value does not prove the data are clean.',
    steps: [
      {
        title: 'Warming at home',
        body: (f, v) => {
          const a = f('bishkek', 'T2M');
          return `Air temperature in Bishkek: ${a.slope} per decade, about ${a.total} since ${a.from} (${a.p}) → ${v(a.verdict)}.`;
        },
      },
      {
        title: 'Interrogate every witness',
        body: () =>
          'The Detective Scan tests all 19 variables in one go. Because many tests are run at once, each p-value is converted into a q-value (Benjamini–Hochberg) — some “significant” results lose their stamp. Cards are sorted by strength of evidence.',
      },
      {
        title: 'A suspicious witness',
        body: (f, v) => {
          const a = f('bishkek', 'CLOUD_AMT');
          return `Cloud cover: ${a.slope} per decade (${a.p}) → ${v(a.verdict)}… but look at the chart.${a.stepYear ? ` The record jumps abruptly around ${a.stepYear}.` : ''} Real climate rarely flips a switch; the same jump appears across Central Asia but not in Madrid or Kenya, which points to a change in the satellites feeding this record. Statistics can’t tell an artefact from a trend — detectives can.`;
        },
      },
    ],
  },
  almost: {
    title: 'Almost significant',
    subtitle: 'Issyk-Kul shore (Cholpon-Ata), Kyrgyzstan',
    lesson: 'Not significant ≠ no change. Sometimes a trend just needs more years.',
    steps: [
      {
        title: 'A hint, not a proof',
        body: (f, v) => {
          const a = f('issyk-kul', 'T2M_MIN');
          return `The coldest hour of each month here changed by ${a.slope} per decade (${a.p}) → ${v(a.verdict)}. The estimate points to warming, but random year-to-year swings could still produce a slope like this.`;
        },
      },
      {
        title: 'How many more years?',
        body: (f) => {
          const a = f('issyk-kul', 'T2M_MIN');
          return a.yts
            ? `If the trend kept the same speed and the same noise, it would likely become significant around ${a.yts}. That is a thought experiment — the future can bend either way.`
            : 'At this speed and noise, the trend would not become significant any time soon.';
        },
      },
      {
        title: 'Time is evidence',
        body: (f, v) => {
          const a = f('issyk-kul', 'T2M_MIN', [1981, 2010]);
          const b = f('issyk-kul', 'T2M_MIN');
          return `With data only up to 2010: ${a.slope} per decade (${a.p}) → ${v(a.verdict)}. With all years to ${b.to}: ${b.slope} per decade (${b.p}) → ${v(b.verdict)}. Notice how much the slope estimate moved: short windows give wobbly trends. Extra years narrow the confidence interval — and sometimes reveal that an early trend was partly luck. Drag the period handles yourself and watch the numbers change.`;
        },
      },
    ],
  },
};
