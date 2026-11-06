# DECISIONS

Running log of decisions made autonomously. Newest at the bottom of each phase.

## Phase 0 — data access

| # | Decision | Why |
|---|---|---|
| D0.1 | **Live browser requests to POWER and GIBS, no proxy.** | Both send `access-control-allow-origin: *` (DATA_NOTES §1). The `proxy/` Cloudflare Worker is kept as an optional escape hatch (`VITE_POWER_PROXY`), not required. |
| D0.2 | **Bundled data for all presets, case files and Trend Map demo regions** in `public/data/`. Data provenance badge: `live` / `cached` / `bundled`. | Demo must not depend on Wi-Fi (SPEC §5). |
| D0.3 | Default window = **1981 → last complete calendar year** (2025 today). Solar/cloud params start **1984**. Retry with `end−1` on failure. | Partial years bias annual stats; POWER recommends ending ~2 months behind NRT. |
| D0.4 | **Drop POWER's 13th "month"**; compute annual aggregates ourselves. | POWER's annual value is inconsistent across params (mean / sum / max). |
| D0.5 | `PRECTOTCORR` annual = Σ(mm/day × days in month) → **mm/yr**; `FROST_DAYS` annual = sum → days/yr; `T2M_MAX` / `T2M_MIN` annual = mean of monthly hottest/coldest hour. Everything else: day-weighted mean. | Units verified (mm/day, days). Mean of monthly extremes is more stable for trends than a single annual extreme. |
| D0.6 | Detective Scan = **one point request with all 20 variables** (limit is 25). | Verified: 20 params → 200 OK, ~2.4 s. |
| D0.7 | Trend Map bbox clamped to **2°–10° per axis**, 1 parameter per request. | Verified POWER validation errors. |
| D0.8 | Request queue: max **2** concurrent POWER requests, exponential backoff with jitter on 429 / 5xx / network errors, **no retry on 422**. | 429 documented, no published numeric limit. |
| D0.9 | Solar/cloud variables (`ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `CLOUD_AMT`) get a **"source change in 2001 (SRB → CERES)"** badge. | POWER methodology page: SRB 4.0-IP 1984–2000, CERES SYN1deg 2001→. |
| D0.10 | Time Machine uses **GIBS WMS GetMap** (one image per date) instead of stitching WMTS tiles. Case-file images pre-downloaded. | Simpler, CORS ✅, works offline when bundled. |
| D0.11 | Base map: `BlueMarble_ShadedRelief_Bathymetry` (static, z≤8) + optional MODIS Terra true colour layer (z≤9) + `Reference_Labels_15m` / `Coastlines_15m` overlays. No third-party tile services. | Everything from GIBS, no keys. |

## Phase 1 — stack

| # | Decision | Why |
|---|---|---|
| D1.1 | TypeScript **6.0.x**, not 7.0. | `typescript-eslint` 8.72 peer range is `<6.1.0`. |
| D1.2 | Keep **Apache ECharts** (modular import from `echarts/core`). | Built-in dataZoom/brush, area bands for CIs, `getDataURL` for PNG export, good perf. |
| D1.3 | **Primary analysis basis = annual aggregates** (1 point per complete year); "monthly anomalies" offered as an alternative basis. Seasonal MK always runs on raw monthly values. | Matches the "per decade" narrative, removes the seasonal cycle by construction, works for summed variables (mm/yr), lower autocorrelation. Both bases are tested. |
| D1.4 | **Primary p-value = OLS with AR(1) correction** (Santer et al. 2000). MK (+ Sen) shown side-by-side; if verdicts differ we show a "methods disagree" note. | SPEC §6: "show the corrected variant as primary". |
| D1.5 | When residual r1 ≤ 0 we set **n_eff = n** (no inflation of the sample size). | Conservative; negative r1 would otherwise *increase* the effective sample. |
| D1.6 | r1 uses only pairs exactly one step apart (gaps don't create fake neighbours). | Same as the standard formula when there are no gaps. |
| D1.7 | Sen CI follows `scipy.stats.theilslopes` (Sen 1968 eq. 2.6 / Gilbert 1987) incl. NumPy's round-half-even when picking ranks. | Lets us test against SciPy exactly. |
| D1.8 | "Signal-to-noise" effect size = (trend × span) / residual SD. | Standardised, unit-free, readable: "change ÷ typical year-to-year wobble". |
| D1.9 | Years-to-significance assumes same slope, residual SD and r1; horizon 150 years; null otherwise. | SPEC §4.11, always shown with a caveat. |

## Phase 2 — data layer

| # | Decision | Why |
|---|---|---|
| D2.1 | **Dropped `EVPTRNS`.** | It exists in POWER but values are implausibly small for an energy flux (Bishkek mean 0.15 MJ/m²/day ≈ 1.7 W/m²; exactly 0 over the former Aral Sea). We could not pin down its meaning, so we don't show it. Catalog = 19 variables. |
| D2.2 | Solar/cloud variables **default to 2001→** (homogeneous CERES segment); user may extend back to 1984 with a warning. | Real data show a step at 2001: e.g. CLOUD_AMT at Kyzylkum 54.8 % (1984–2000) → 36.2 % (2001–2017). |
| D2.3 | **Step-change check** (`stats/homogeneity.ts`): BIC of one-jump model vs linear trend; ΔBIC > 10 → "possible step" warning. | CLOUD_AMT also drops abruptly in **2017** over Central Asia (Bishkek 75 % → 61 %, Tian Shan 82 % → 62 %) but not in Madrid/Kenya/Sahara — almost certainly an input-satellite change, not climate. Users must be told when a "trend" is really a jump. |
| D2.4 | Constant series (e.g. snow depth = 0 in the tropics) → verdict "insufficient" with a "doesn't vary here" message instead of a misleading p = 1. | Honesty. |
| D2.5 | Each point request fetches **all 19 variables, 1981 → last complete year** once; period selection is client-side. | One request per place = instant re-analysis, matches Detective Scan, simple cache. |
| D2.6 | Loader order: exact bundled preset → IndexedDB → live → bundled in same MERRA-2 cell → cached. Provenance shown in UI. | Offline-proof demo, fast repeat visits. |
| D2.7 | All bundled data lives in `public/data/demo/` (17 points, 8 regional grids, 2 GIBS images; ≈ 9 MB). | SPEC: Case Files must not depend on Wi-Fi. |
| D2.8 | Case-file candidates verified on real data (see `scripts/dev/summarize.ts`). Kept: Svalbard warming; Aral (images + T2M_MAX significant, mean T not yet); Central Asia snow both ways (mountains ↑, plains ↓, both warming & moistening); Bishkek warming; Issyk-Kul T2M_MIN "almost significant". East Africa precipitation is bundled for the Trend Map but its Lake Victoria decline happens largely around 1998 (ΔBIC ≈ 7), so it is presented with that caveat, not as a headline case. | Science before spectacle. |

## Phase 3 — P0 UI

| # | Decision | Why |
|---|---|---|
| D3.1 | Chart shows **anomalies by default** (toggle to raw values). | With raw monthly temperatures the ±20 °C seasonal cycle hides a 1 °C trend; anomalies make the trend visible without changing any statistic. |
| D3.2 | Chart is in **monthly units**, trends reported in **annual units**; yearly dots = annual aggregate ÷ factor (1, 12 or 365.25) so dots and trend line share one axis (no dual axis). | Precipitation is mm/day monthly but mm/yr annually. |
| D3.3 | The chart's zoom slider **is** the analysis period (snapped to whole years) and mirrors the From/To inputs (keyboard-accessible alternative). | "What you see is what is analysed". |
| D3.4 | Everything shareable is in the URL hash (`#explore?lat=…&v=…&from=…`), `history.replaceState`. | Share links without a backend. |
| D3.5 | MapLibre's module worker is bundled via `?worker&url` + `setWorkerUrl`. | Default relative worker lookup breaks under Vite pre-bundling. |
| D3.6 | Heavy libraries (MapLibre ≈ 294 kB gz, ECharts ≈ 192 kB gz) and every non-default mode are lazy chunks; initial JS ≈ 100 kB gz. | First-load budget. |
| D3.7 | Glossary tooltips are `display:none` when closed but still referenced by `aria-describedby`. | Avoids off-screen layout overflow on phones; screen readers still read the definition. |

## Phase 4 — Detective Scan & Trend Map

| # | Decision | Why |
|---|---|---|
| D4.1 | Scan verdicts use the **BH q-value**; the unadjusted verdict is shown when it differs. | SPEC §6; makes the multiple-testing lesson visible. |
| D4.2 | Evidence board order: verdict → clean records before step-flagged ones → q → \|signal-to-noise\|. | A trend that looks like a source jump is weaker evidence even with a small p. |
| D4.3 | Trend Map per cell: **Sen's slope + original Mann-Kendall** on annual aggregates, **Wilks (2016) FDR, α_FDR = 0.10**; significant cells stippled with a dot (not colour only). Colour scale symmetric at the 95th percentile of \|slope\|. | SPEC §4.8; robust to outliers; avoids one extreme cell washing out the map. |
| D4.4 | Bundled regions render automatically; arbitrary regions ("around the current spot", 10° × 10°) need an explicit click (2.9 MB live request). | Offline demo + no surprise downloads. |
| D4.5 | Scan and per-cell tests run in a Comlink Web Worker; the pure core (`workers/analysisCore.ts`) is unit-tested. | Keeps the UI responsive; testable without a browser. |
| D4.6 | Explore layout: globe is a sticky full-height left column; all controls live in the right column. | The map overlay stays visible while reading the results. |
| D4.7 | GIBS label layer switched to `Reference_Labels` (Level 9). | `Reference_Labels_15m` returned HTTP 500 for many tiles. |

## Phase 5 — Case Files, Time Machine, Compare, Learn, BYOD

| # | Decision | Why |
|---|---|---|
| D5.1 | Five cases: **Snow goes both ways** (home region, opposite directions), **Arctic fever**, **The vanished sea**, **Home base: Bishkek** (data artefact lesson), **Almost significant**. East Africa stays a Trend Map region only. | Each story verified on real data; each teaches one skill. |
| D5.2 | Tour numbers are **computed at runtime** from the bundled data (`features/case-files/facts.ts`) and guarded by **story regression tests** (`content/cases.test.ts`). | Text can never drift from the charts; a re-prefetch that breaks a claim fails CI. |
| D5.3 | "Almost significant" step 3 shows that the 1981–2010 slope (+0.44 °C/decade) is twice the full-record slope (+0.22): short windows give wobbly trends. | Honest: the original idea ("more years shrink uncertainty") was not what the data showed. |
| D5.4 | Aral "the model can't see the lake shrink" lesson rests on the verified fact that land ET = 0 for the cell in every month; phrased as "suggests", not "proves". | We cannot inspect MERRA-2's land mask from POWER directly. |
| D5.5 | Compare difference test: z = (b_B − b_A)/√(SE_A² + SE_B²) with AR(1)-adjusted SEs, places treated as independent (stated in the UI). | Simple, transparent; neighbouring places are not fully independent — disclosed. |
| D5.6 | Time Machine uses bundled Aral images in the case (offline) and live GIBS WMS for any place (±2° box, user-selected dates from 2000-02-24). | SPEC §4.10. |
| D5.7 | BYOD CSV: tolerant parser (metadata lines skipped, delimiter + date/value columns detected, declared and common fill values removed, daily → monthly means, annual data supported); analysed fully client-side. Giovanni guide in Learn. | SPEC §4.13 — covers MODIS, OMI, AIRS, GPM, GLDAS without a backend. |
| D5.8 | Fixed ECharts band stacking (`stackStrategy: 'all'`). | Default same-sign stacking broke the CI band whenever its lower edge was below 0. |

## Phase 6 — polish

| # | Decision | Why |
|---|---|---|
| D6.1 | Bundle Blue Marble tiles z0–4 (341 tiles, 3 MB) behind a `gibsfb://` MapLibre protocol: network first, bundled fallback. | The globe stayed black offline; the demo must not depend on Wi-Fi. Verified by `npm run smoke` (offline context). |
| D6.2 | Smoke test (`scripts/smoke.cjs`) runs the production build twice: online (verdict, scan, all modes) and with every external host blocked (all 21 Case File steps, Time Machine images, offline globe). | Proves the offline promise automatically. |
| D6.3 | axe-core WCAG 2 A/AA audit on Explore, Case Files, Compare, Learn and a tour step, dark + light: 0 violations after fixes (marker role, combobox ARIA, light-theme stamp colour #8f4300). | SPEC §7 accessibility. |
| D6.4 | Tour card is not a scroll container (has a Minimise button instead). | `overflow-y: auto` on a fixed element over the WebGL canvas produced a black compositing artefact over the globe. |
| D6.5 | MapLibre container observed with ResizeObserver → `map.resize()`. | MapLibre only listens to window resizes. |
| D6.6 | Measured first load (production build, 10 Mbit/s, 150 ms RTT): FCP 0.65 s, first verdict 1.8 s; initial JS ≈ 83 kB gzip, map and chart lazy. | SPEC §7: < 3 s. |

## Feature — Site check (climate suitability score, requested after submission)

| # | Decision | Why |
|---|---|---|
| D8.1 | (superseded by D8.8) The 0–100 score was first a **climate-only** screening; the panel always lists what is NOT included (earthquakes first, then slope, flood zones, mudflows, soils, roads, population, zoning). | Our data are NASA POWER climate fields on ~50 km cells. Pretending to assess building siting would mislead — and in Central Asia seismic hazard dominates siting. |
| D8.2 | Polygon → sample the centroid + every MERRA-2 cell centre inside it (max 6 point requests); statistics averaged, ranges shown. Polygons > 10° across are refused; areas smaller than a grid cell get a resolution note. | Same data path as Explore (bundled/cached/live); honest about resolution. |
| D8.3 | Factors from the last 30 complete years: hottest/coldest hour of the year, max monthly dew point, frost days, wettest month, topsoil wetness, annual precipitation, deepest monthly snow, mean 10 m wind, all-sky sunlight (2001 → only), plus significant 1981 → trends of the hottest hour and of rainfall. | Each maps to a concrete building concern (heat stress, heating, flooding, water supply, roof load, wind load, solar yield, growing risk). |
| D8.4 | Sub-scores via linear ramps with documented thresholds (`src/content/siteRules.ts`), weights per building type (hospital, school, housing, warehouse, solar plant). Rules are plain data, easy to change. | Transparent and debatable — better than a black box. |
| D8.5 | Total = **weighted geometric mean** (floor 5), not arithmetic. | With an arithmetic mean Yakutsk (coldest hour −53 °C) scored 79 for a hospital and Delhi (hottest hour 47 °C) 73; a single critical factor must not be averaged away (same idea as the UN HDI). Now Yakutsk 63, Delhi 50, Madrid 84. |
| D8.6 | Rainfall-trend penalty ignored where annual precipitation < 150 mm. | A +20 %/decade change of almost nothing is meaningless (Sahara). |
| D8.7 | Building type and polygon are stored in the share link (`site=…&poly=lat,lon;…`). | Same as every other view. |
| D8.8 | **Ground checks added** after user feedback (“seas and mountains get high scores”): MODIS_Water_Mask (250 m), ASTER_GDEM_Color_Index (elevation, ~30 m source, read at ~250 m), NDH_Landslide_Hazard_Distribution_2000 (1 km) via GIBS WMS, decoded exactly with the official GIBS colormaps (`scripts/gen_colormaps.py` → `src/data/gibsColormaps.ts`). Verified: 100 % of pixels match a colormap entry. | Climate alone cannot see water or relief. |
| D8.9 | Slope: 3×3 mean filter, then central differences over ~500 m; “gentle” = slope ≤ 15 %. | DEM colours are 5–50 m bins; without smoothing and a wide baseline the bins would create fake slopes (≤ ~5 % error this way). |
| D8.10 | Hard stops: ≥ 50 % water → total ≤ 3; < 10 % gentle land or mean elevation > 4500 m → total ≤ 15 (“Not buildable”). Weakest link: total ≤ 25 + 0.75 × worst ground sub-score. Ground weighs 45 % of the total (40 % for solar plants). Shorelines (≤ 25 % water) are not penalised. | Measured on real data: Atlantic 3, Issyk-Kul 3, Everest 15, Tian Shan peaks 25 (was 42 before the weakest-link rule), Bishkek valley 85, Sydney coast 94. |
| D8.11 | Ground maps are fetched with 3 retries. If the water mask still fails: ASTER has no data over the sea → ≥ 50 % missing elevation is treated as water; otherwise the result is shown as **“Incomplete check”** without a number and with a retry button. | One transient GIBS failure once scored Issyk-Kul 89 — never again silently. |
