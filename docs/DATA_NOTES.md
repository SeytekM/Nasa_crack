# DATA NOTES — verified facts about NASA POWER and GIBS

All facts below were verified with real requests on **2026-11-05** (POWER API
v2.10.0). Nothing here is assumed from memory unless marked *(unverified)*.

## 1. CORS

| Endpoint | `Origin: http://localhost:5173` → `access-control-allow-origin` |
|---|---|
| POWER `/api/temporal/monthly/point` | `*` ✅ |
| POWER `/api/temporal/monthly/regional` | `*` ✅ |
| GIBS WMTS GetCapabilities (`/wmts/epsg3857/best/wmts.cgi`) | `*` ✅ |
| GIBS WMTS tiles (`.jpeg`, `.png`) | `*` ✅ (also exposes `layer-time-actual` etc.) |
| GIBS WMS GetMap (`/wms/epsg4326/best/wms.cgi`) | `*` ✅ |

**Decision:** live requests go straight from the browser. No proxy is required.
We still ship bundled data (`public/data/…`) for every preset, case file and
Trend Map region so the demo works offline, and the UI labels each series as
`live` / `cached` (IndexedDB) / `bundled`. The optional proxy (`proxy/`,
`VITE_POWER_PROXY`) is kept as a tiny escape hatch only.

## 2. Response format (monthly point)

```jsonc
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [lon, lat, elevation_m] },
  "properties": {
    "parameter": {
      "T2M": { "198101": -6.31, "198102": ..., "198113": 9.87, ... }
    }
  },
  "header": {
    "title": "NASA/POWER Source Native Resolution Monthly and Annual",
    "api": { "version": "v2.10.0", "name": "POWER Monthly and Annual API" },
    "sources": ["MERRA2", "SRB", "SYN1DEG", "POWER"],
    "fill_value": -999.0,
    "time_standard": "LST",
    "start": "19810101", "end": "20251231"
  },
  "messages": [],
  "parameters": { "T2M": { "units": "C", "longname": "Temperature at 2 Meters" } },
  "times": { "data": 1.35, "process": 0.06 }
}
```

* Values: `properties.parameter[CODE][YYYYMM]`.
* Keys are `YYYYMM`; **month `13` is the annual value** → we drop it and compute
  annual aggregates ourselves (POWER's 13th value is a plain mean for most
  params, a **sum** for `FROST_DAYS`, and a **max** for `T2M_MAX`).
* Fill value: `header.fill_value = -999.0`. Months not yet produced are also
  `-999` (e.g. 2026-10 onwards on 2026-11-05).
* Units come back in `parameters[CODE].units`.
* Errors: HTTP **422** with `{"header": "...failed...", "messages": [..]}`;
  HTTP **429** = too many requests (documented on the POWER API overview page).

### Latest available data

* `GET /api/temporal/monthly/configuration` → `settings.end = 2026-11-30`.
* `end=2026` works (200) but months after the latest MERRA-2/GEOS-IT update are
  `-999` (T2M filled through 2026-09, solar through 2026-07).
* POWER docs warn the last few months may be GEOS-IT (near-real-time), and
  recommend ending climate-trend analyses ~2 months behind real time.
* **Decision:** the default analysis window ends at the **last complete calendar
  year** (`currentYear − 1`, i.e. 2025). If a request fails we retry with
  `end − 1`. Partial trailing years are never used for annual statistics.

## 3. Limits

| Limit | Value | How verified |
|---|---|---|
| Max parameters per **point** request | **25** | 25 → 200, 40 → 422 `"A maximum of 25 parameters…"` |
| Duplicate params | rejected (422) | same 422 message |
| Max parameters per **regional** request | **1** | 2 → 422 `"A maximum of 1 parameters…"` |
| Regional bbox | **≥ 2° and ≤ 10°** on each axis | 1° → 422 "at least a 2 degree range"; 11° → 422 "maximum of 10 degree range" |
| Rate limit | HTTP 429 (no numeric limit published) | POWER API docs, "Errors" table |
| Point request, 20 params × 45 yr | ~2.4 s, 170 kB | measured |
| Regional 10°×10°, 1 param × 45 yr | ~1.4 s, **2.9 MB**, 357 cells | measured |

Client policy: request queue with **max 2 concurrent** POWER requests,
exponential backoff on 429/5xx/network errors (0.8 s, 1.6 s, 3.2 s + jitter, 3
retries), no retry on 422.

### Grids

* MERRA-2 parameters: native **0.5° lat × 0.625° lon** grid (regional returns
  cell centres, e.g. lats 40.0, 40.5… lons 70.0, 70.625…).
* Solar parameters (`ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `CLOUD_AMT`):
  **1° × 1°** grid, centres at x.5 (e.g. 40.5, 41.5).
* Point requests return the native grid cell containing the point (the
  response echoes the requested coordinates plus the cell's elevation).

## 4. Variable catalog (all 20 candidates verified)

One point request with all 20 candidates (`community=AG`, Bishkek
42.9 N 74.6 E, 1981–2025) returned 200 with every parameter present.
Definitions below are from `/api/system/manager/parameters?community=AG&temporal=monthly`.

| Code | Units | POWER name | Source | First valid month | Annual agg (ours) |
|---|---|---|---|---|---|
| T2M | °C | Temperature at 2 Meters | MERRA-2 | 1981-01 | mean |
| T2M_MAX | °C | Temperature at 2 m Maximum — **max hourly value in the month** | MERRA-2 (POWER-derived) | 1981-01 | mean of monthly maxima |
| T2M_MIN | °C | Temperature at 2 m Minimum — **min hourly value in the month** | MERRA-2 (POWER-derived) | 1981-01 | mean of monthly minima |
| T2M_RANGE | °C | Range between min and max hourly T in the period | MERRA-2 (POWER-derived) | 1981-01 | mean |
| TS | °C | Earth Skin Temperature | MERRA-2 | 1981-01 | mean |
| T2MDEW | °C | Dew/Frost Point at 2 m | MERRA-2 | 1981-01 | mean |
| PRECTOTCORR | **mm/day** | Precipitation Corrected (MERRA-2 bias-corrected) | MERRA-2 | 1981-01 | **sum → mm/yr** (Σ mm/day × days in month) |
| RH2M | % | Relative Humidity at 2 m | MERRA-2 (POWER-derived) | 1981-01 | mean |
| QV2M | g/kg | Specific Humidity at 2 m | MERRA-2 | 1981-01 | mean |
| WS2M | m/s | Wind Speed at 2 m | MERRA-2 (POWER-derived) | 1981-01 | mean |
| WS10M | m/s | Wind Speed at 10 m | MERRA-2 (POWER-derived) | 1981-01 | mean |
| ALLSKY_SFC_SW_DWN | MJ/m²/day | All-sky surface shortwave downward irradiance (GHI) | **SRB R4-IP (1984–2000) → CERES SYN1deg Ed4.2 (2001→)** | **1984-01** | mean |
| CLRSKY_SFC_SW_DWN | MJ/m²/day | Clear-sky surface SW downward irradiance | SRB → CERES | **1984-01** | mean |
| CLOUD_AMT | % | Cloud Amount | SRB → CERES | **1984-01** | mean |
| GWETTOP | 0–1 | Surface Soil Wetness (top 5 cm) | MERRA-2 | 1981-01 | mean |
| GWETROOT | 0–1 | Root Zone Soil Wetness (~top 1 m) | MERRA-2 | 1981-01 | mean |
| GWETPROF | 0–1 | Profile Soil Moisture (surface to bedrock) | MERRA-2 | 1981-01 | mean |
| SNODP | cm | Snow Depth (land) | MERRA-2 | 1981-01 | mean |
| FROST_DAYS | days | Frost Days (T2M cools to dew point and both < 0 °C) | MERRA-2 (POWER-derived) | 1981-01 | **sum → days/yr** |
| EVPTRNS | MJ/m²/day | Evapotranspiration **energy** flux | MERRA-2 | 1981-01 | mean |

Notes:

* `EVPTRNS` exists but is an energy flux (latent heat), not mm of water. We
  label it honestly ("evapotranspiration energy").
* Extra parameters seen working in the same call (not in the brief): `PS`,
  `WS50M`, `T2MWET`, `PRECSNOLAND`, `EVLAND`. Not used for now.
* **Solar step warning:** POWER's own "Energy Fluxes" methodology page states
  SRB 4.0-IP covers 1984-01-01…2000-12-31 and CERES SYN1deg covers 2001-01-01
  onward. A source change can create an artificial step at **2001** →
  `ALLSKY_SFC_SW_DWN`, `CLRSKY_SFC_SW_DWN`, `CLOUD_AMT` carry a warning badge
  and the default window for them starts in 1984.

## 5. GIBS

GetCapabilities: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0` (5.8 MB, 1332 layers).

URL template (from `ResourceURL`):
`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{Time}/{TileMatrixSet}/{z}/{y}/{x}.{ext}`
(static layers have no `{Time}` segment).

| Layer | Format | TileMatrixSet (max zoom) | Time |
|---|---|---|---|
| `BlueMarble_ShadedRelief_Bathymetry` | jpeg | `GoogleMapsCompatible_Level8` (z 0–8) | static |
| `BlueMarble_NextGeneration` | jpeg | `GoogleMapsCompatible_Level8` | static |
| `MODIS_Terra_CorrectedReflectance_TrueColor` | jpeg | `GoogleMapsCompatible_Level9` (z 0–9) | daily, 2000-02-24 → today (gaps) |
| `MODIS_Aqua_CorrectedReflectance_TrueColor` | jpeg | `GoogleMapsCompatible_Level9` | daily, 2002-07-03 → today (gap 2022-04-01…04-16) |
| `VIIRS_SNPP_CorrectedReflectance_TrueColor` | jpeg | `GoogleMapsCompatible_Level9` | daily, 2015-11-24 → |
| `VIIRS_Black_Marble` | png | `GoogleMapsCompatible_Level8` | 2012, 2016 |
| `Reference_Labels_15m` | png | `GoogleMapsCompatible_Level13` | static |
| `Coastlines_15m` | png | `GoogleMapsCompatible_Level13` | static |

* Tile CORS ✅. Tile path order is `{TileMatrix}/{TileRow}/{TileCol}` = `{z}/{y}/{x}`.
* Terra's recent Dimension values contain gaps (e.g. 2025-08-09, 2025-11-09).
* **Time Machine** uses WMS GetMap (single image per date, CORS ✅):
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&STYLES=&CRS=EPSG:4326&BBOX={latMin},{lonMin},{latMax},{lonMax}&WIDTH=800&HEIGHT=640&FORMAT=image/jpeg&TIME=YYYY-MM-DD`
  (WMS 1.3.0 + EPSG:4326 → axis order lat,lon). Verified with the Aral Sea,
  2000-08-20. Case-file snapshots are pre-downloaded into `public/data/demo/`.

## 6. Cache

IndexedDB via `idb-keyval`, key = normalized request URL (sorted query params,
lower-cased keys, rounded coordinates). Stored value = parsed JSON + fetch
timestamp. Re-analysis of the same place is served from cache instantly; the UI
labels it `cached`.

## 7. Attribution (checked against the sites)

* POWER referencing guide (`https://power.larc.nasa.gov/docs/referencing/`,
  fetched 2026-11-05): *"The data was obtained from National Aeronautics and
  Space Administration (NASA) Langley Research Center's Prediction Of Worldwide
  Energy Resources (POWER) project funded through the NASA Earth Science
  Division."* The page also asks to include the service name, version number and
  date accessed → we append "POWER Monthly and Annual API v2.10.0, accessed
  YYYY-MM-DD".
* GIBS: standard acknowledgement *"We acknowledge the use of imagery provided by
  services from NASA's Global Imagery Browse Services (GIBS), part of NASA's
  Earth Science Data and Information System (ESDIS)."* *(earthdata.nasa.gov is
  not reachable from the build container, so this text is from the GIBS
  documentation as remembered — re-check before submission.)*
