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
