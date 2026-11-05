# Earth Trend Detective — NASA Space Apps submission

> Fill in team name, members and the final demo URL before submitting.

## One-liner

A browser-based detective kit that lets students pick any place on Earth,
pull 45 years of NASA data, and find out **what is changing, where, by how
much — and whether it is statistically significant**, with honest, plain-language
verdicts.

## The problem

Climate data are everywhere, but the questions a student actually has —
*Is it really getting warmer here? Is that change real or just noise? Why does
the same variable go up in one place and down in another?* — require
downloading files, writing code and knowing statistics. Most tools either show a
pretty map without uncertainty, or real statistics without context.

## What we built

* **Explore** any point on a NASA GIBS globe: 19 NASA POWER variables (air and
  surface temperature, hottest/coldest hour, dew point, frost days,
  precipitation, humidity, soil wetness at three depths, snow depth, sunlight,
  clear-sky sunlight, cloud cover, wind) from 1981 to 2025.
* **Measure and test** the trend: slope per decade with a 95 % confidence
  interval, t-test corrected for autocorrelation, Mann-Kendall, Sen's slope,
  Seasonal Mann-Kendall — summarised by a verdict stamp
  (SIGNIFICANT / SUGGESTIVE / NOT SIGNIFICANT YET) and one correctly worded
  sentence about the p-value.
* **Detective Scan**: all 19 variables in one request, ranked on an evidence
  board with false-discovery-rate (q-value) correction.
* **Trend Map**: per-grid-cell trends with Wilks (2016) FDR stippling — this is
  where the challenge's key nuance becomes visible: *the same variable rising in
  one place and falling in another*.
* **Case Files**: five guided investigations, **Time Machine** satellite
  before/after, **Compare** two places, **Bring your own data** (Giovanni CSV),
  **Learn** page with formulas and references.
* Works **offline** (the whole demo is bundled), on phones, in a light
  projector theme, keyboard- and screen-reader-friendly (0 axe-core WCAG A/AA
  violations).

## What we found with it (real NASA data, 1981–2025)

| Finding | Evidence |
|---|---|
| **Snow goes both ways in the Tian Shan region** — the same 10° box shows snow depth significantly **increasing in 35 mountain cells and decreasing in 35 plains cells** (after FDR control). | Ili River plains −0.33 cm/decade (p < 0.001) vs mountains above Almaty +0.93 cm/decade (p = 0.003). Both places warm significantly and both get more humid (specific humidity +0.15 g/kg/decade): extra moisture falls as snow where it is still cold enough, while warming shortens the snow season lower down. |
| **Arctic fever** — Svalbard air temperature +0.77 °C/decade (≈ +3.4 °C since 1981, p < 0.001), snow depth and frost days falling; *every* grid cell around Svalbard warms significantly. | Several times the global-average rate. |
| **A suspicious witness** — cloud cover over Bishkek "drops significantly", but the record jumps abruptly in 2017 across Central Asia and not elsewhere: a data-source artefact, which our step-change check flags. | Lesson: a small p-value doesn't prove the data are clean. |
| **The vanished sea** — satellite images show the Aral Sea gone; the hottest hour of the month over the old sea bed rose significantly, mean temperature not yet; the raw data suggest the reanalysis still treats the cell as water. | Satellites, models and statistics each see part of the truth. |

## NASA data and how we use it

| NASA resource | How |
|---|---|
| **NASA POWER** Monthly & Annual API (MERRA-2 reanalysis; GEWEX SRB and CERES SYN1deg radiation) | Point requests (all 19 variables in one call) for Explore, Scan, Compare and Case Files; regional requests (one variable, up to 10° × 10°) for the Trend Map. Called directly from the browser (CORS), cached in IndexedDB, bundled for offline use. |
| **NASA GIBS** WMTS / WMS | Globe imagery (Blue Marble, MODIS Terra Corrected Reflectance, reference labels) and Time Machine snapshots (MODIS Terra, cloud-free August 2000 and 2025 Aral Sea images). |
| **NASA Giovanni** (via user CSV exports) | "Bring your own data" covers MODIS, OMI, AIRS, GPM IMERG and GLDAS time series without a backend. |
| **MERRA-2 / POWER documentation** | Variable definitions, units, source periods (SRB → CERES in 2001), referencing guide. |

## Scientific honesty

* p-values are worded correctly ("a trend this strong would appear by chance
  less than X % of the time if there were no real change"), never as "the
  probability the trend is real". We never write "there is no trend".
* Autocorrelation correction is the default; multiple testing is corrected
  (BH q-values, Wilks FDR).
* Reanalysis is labelled as a model + observations, not a measurement. Known
  source changes are shown as warnings; abrupt jumps are flagged automatically.
* Every statistic is tested against SciPy / pymannkendall (140 automated
  tests), and every claim in the Case Files is guarded by a test that fails if
  re-downloaded data stop supporting it.

## Tools

TypeScript, React, Vite, Tailwind CSS, MapLibre GL JS (globe), Apache ECharts,
Zustand, Comlink Web Workers, idb-keyval, Vitest, Playwright; Python (SciPy,
pymannkendall) for test fixtures only. Static site — no backend, no keys.

**Use of AI:** the code and documentation were developed with the help of an AI
coding assistant (Claude Code); the team reviewed the scientific claims against
the data. *(Edit to reflect your team's actual process.)*

---

## 30-second video script

| Time | Picture | Voice-over / caption |
|---|---|---|
| 0–4 s | Night globe spins, lands on Central Asia. Title card *Earth Trend Detective*. | "Is the climate really changing where you live? Let's investigate." |
| 4–10 s | Click Bishkek → chart draws, stamp lands **SIGNIFICANT**: "+0.30 °C per decade since 1981". | "45 years of NASA data, one click. The trend, its uncertainty, and an honest verdict." |
| 10–16 s | Detective Scan: evidence board fills up, cards flip; cloud-cover card shows "sudden jump" warning. | "Test 19 variables at once — and catch data artefacts that fool simple statistics." |
| 16–24 s | Trend Map over the Tian Shan: teal mountains, brown plains, dots appear. Zoom to the two places side by side. | "Same region, same cause, opposite answers: more snow on the peaks, less on the plains." |
| 24–30 s | Time Machine curtain sweeps across the Aral Sea 2000 → 2025; end card with URL. | "Satellites, models and statistics — together. Become an Earth Trend Detective." |

## 7-slide plan

1. **Hook** — "Is it really changing?" A single chart without uncertainty vs the
   same chart with our verdict stamp. The challenge in one sentence.
2. **The tool** — screenshot of Explore: pick a place → variable → trend →
   verdict. Audience: students; zero setup; works offline.
3. **The detective method** — anomalies → slope → autocorrelation-corrected test
   → Mann-Kendall/Sen → verdict; correct p-value wording; validated against
   SciPy (140 tests).
4. **Where is it changing?** — Trend Map of Tian Shan snow depth: 35 cells up,
   35 down after FDR; the "same cause, opposite directions" explanation.
5. **Be sceptical** — the 2017 cloud-cover jump and the Aral Sea (satellite vs
   reanalysis): what data can and cannot tell you.
6. **NASA data inside** — POWER (MERRA-2, SRB/CERES), GIBS, Giovanni CSVs;
   offline bundle; accessibility; architecture diagram (static site + Web
   Workers).
7. **Impact & next steps** — classroom Case Files, more languages (Russian/Kyrgyz
   dictionary ready), more datasets via Giovanni, teacher mode; demo URL + QR.
