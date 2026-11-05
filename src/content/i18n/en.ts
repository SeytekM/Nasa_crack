/**
 * The single English dictionary. To add a language, copy this file, translate
 * the values, keep the keys and function signatures (TypeScript enforces it via
 * the `Dict` type), and register it in ./index.ts.
 */
import type { SourceKind, Theme, VarCode } from '../../data/catalog';
import type { Provenance } from '../../data/types';
import type { Verdict, WarningCode } from '../../stats/analyze';
import type { TerrainType } from '../rules';

const pct = (p: number) => {
  if (p < 0.001) return 'less than 0.1%';
  if (p < 0.01) return `about ${(p * 100).toFixed(1)}%`;
  return `about ${Math.round(p * 100)}%`;
};

export const en = {
  app: {
    name: 'Earth Trend Detective',
    tagline: 'What is changing, where, by how much — and is it significant?',
    skip: 'Skip to analysis',
  },
  nav: {
    explore: 'Explore',
    cases: 'Case Files',
    compare: 'Compare',
    learn: 'Learn',
    themeDark: 'Night mode',
    themeLight: 'Projector mode',
    themeToggle: 'Toggle light / dark theme',
  },
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    cancel: 'Cancel',
    apply: 'Apply',
    copy: 'Copy',
    copied: 'Copied!',
    open: 'Open',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    years: 'years',
    perDecade: 'per decade',
    learnMore: 'Learn more',
    showMore: 'Show details',
    showLess: 'Hide details',
    unknown: '—',
  },
  provenance: {
    label: 'Data',
    live: 'LIVE',
    cached: 'CACHED',
    bundled: 'BUNDLED',
    uploaded: 'UPLOADED',
    describe: {
      live: 'Fetched just now from the NASA POWER API.',
      cached: 'Loaded from this browser’s cache (fetched earlier from NASA POWER).',
      bundled: 'Pre-downloaded from NASA POWER and shipped with the app, so it works offline.',
      uploaded: 'Your own file — analysed only in this browser.',
    } satisfies Record<Provenance, string>,
    fallback: (reason: string) => `Live request failed (${reason}); showing saved data instead.`,
    fetched: (when: string) => `retrieved ${when}`,
  },
  themes: {
    heat: { label: 'Heat', blurb: 'Temperatures, hot days, cold nights' },
    water: { label: 'Water', blurb: 'Rain, humidity, soil moisture' },
    snow: { label: 'Snow & Ice', blurb: 'Snow depth, frost days' },
    sun: { label: 'Sun & Clouds', blurb: 'Sunlight and cloud cover' },
    wind: { label: 'Wind & Air', blurb: 'Wind speed and air moisture' },
  } satisfies Record<Theme, { label: string; blurb: string }>,
  sources: {
    merra2: {
      label: 'Reanalysis · MERRA-2',
      short: 'Reanalysis',
      detail:
        'NASA’s MERRA-2 is a weather model that continuously absorbs satellite and ground observations to reconstruct past weather on a ~50 km grid (0.5° × 0.625°). It is a best estimate, not a direct measurement at this exact spot.',
    },
    'merra2-derived': {
      label: 'Derived from MERRA-2 by NASA POWER',
      short: 'Reanalysis-derived',
      detail:
        'Computed by NASA POWER from hourly MERRA-2 reanalysis fields (for example, the warmest hour of each month). Same strengths and limits as MERRA-2.',
    },
    'srb-ceres': {
      label: 'Satellite-derived · SRB → CERES',
      short: 'Satellite-derived',
      detail:
        'Estimated from satellite observations plus radiation models on a 1° grid (~110 km). The source switches from GEWEX SRB (1984–2000) to CERES SYN1deg (2001 onward), which can create an artificial jump in 2001.',
    },
  } satisfies Record<SourceKind, { label: string; short: string; detail: string }>,
  vars: {
    T2M: {
      name: 'Air temperature',
      definition: 'How warm the air is about 2 m above the ground — roughly where you feel it — averaged over each month.',
      why: 'Extra greenhouse gases trap heat near the surface. Local changes — irrigation, cities, a shrinking lake — can add to or offset that.',
    },
    T2M_MAX: {
      name: 'Hottest hour of the month',
      definition: 'The single warmest hourly air temperature (2 m) in each month. The yearly value is the average of the 12 monthly peaks.',
      why: 'Heat extremes respond to warming and to drier soils: with less water to evaporate, sunshine heats the air instead.',
    },
    T2M_MIN: {
      name: 'Coldest hour of the month',
      definition: 'The single coldest hourly air temperature (2 m) in each month. The yearly value is the average of the 12 monthly lows.',
      why: 'Nights and winters often warm faster than days — especially where snow cover shrinks or the air gets more humid (moist air holds heat at night).',
    },
    T2M_RANGE: {
      name: 'Temperature swing',
      definition: 'The difference between the hottest and the coldest hour in each month.',
      why: 'More clouds or humidity dampen the swing; drier, clearer air widens it.',
    },
    TS: {
      name: 'Ground-surface temperature',
      definition: 'The temperature of the surface itself — soil, snow, water — not the air above it (“skin temperature”).',
      why: 'Follows air temperature, but also reacts to changes in snow cover, vegetation and soil moisture.',
    },
    T2MDEW: {
      name: 'Dew point',
      definition: 'The temperature the air would have to cool to for dew (or frost) to form. A higher dew point means more water vapour in the air.',
      why: 'Warmer air can hold about 7% more water vapour per °C, so dew points often rise with warming — unless the land dries out.',
    },
    FROST_DAYS: {
      name: 'Frost days',
      definition: 'Days when the air cools to its dew point with both below 0 °C, so frost can form. Yearly value = total days per year.',
      why: 'Fewer frost days is a common fingerprint of warmer nights and winters.',
    },
    PRECTOTCORR: {
      name: 'Precipitation',
      definition: 'Rain plus melted snow, as millimetres of water (MERRA-2 bias-corrected). Yearly value = total for the year.',
      why: 'A warmer atmosphere carries more moisture, but shifting winds decide where it falls — some places get wetter, others drier.',
    },
    RH2M: {
      name: 'Relative humidity',
      definition: 'How close the air near the ground is to being saturated with water vapour, in %.',
      why: 'It can fall even while the air holds more water: if temperature rises faster than moisture, relative humidity drops.',
    },
    QV2M: {
      name: 'Specific humidity',
      definition: 'Grams of water vapour in each kilogram of air near the ground — the actual amount of moisture.',
      why: 'Warmer oceans and air supply and hold more vapour; irrigation or drying land change it locally.',
    },
    GWETTOP: {
      name: 'Topsoil wetness',
      definition: 'How wet the top 5 cm of soil is, from 0 (bone dry) to 1 (saturated).',
      why: 'Reacts quickly to rain, heat and evaporation — an early sign of drought or of a wetter climate.',
    },
    GWETROOT: {
      name: 'Root-zone soil wetness',
      definition: 'Wetness of roughly the upper 1 m of soil where plant roots live, from 0 to 1.',
      why: 'Adds up months of rain and evaporation; matters for crops and forests.',
    },
    GWETPROF: {
      name: 'Deep soil wetness',
      definition: 'Wetness of the whole soil column down to bedrock, from 0 to 1.',
      why: 'The slowest to respond — it tracks the long-term water balance.',
    },
    SNODP: {
      name: 'Snow depth',
      definition: 'Average depth of snow on the ground over each month, in cm (land only).',
      why: 'Warming shortens the snow season — but where it stays below freezing, extra moisture can mean more snow.',
    },
    ALLSKY_SFC_SW_DWN: {
      name: 'Sunlight at the surface',
      definition: 'Solar energy reaching flat ground per day, including the effect of clouds and haze.',
      why: 'Changes with cloudiness and with air pollution (aerosols): cleaner air → brighter, more clouds → dimmer.',
    },
    CLRSKY_SFC_SW_DWN: {
      name: 'Clear-sky sunlight',
      definition: 'Solar energy that would reach the ground if there were no clouds. Differences come from dust, smoke, pollution and water vapour.',
      why: 'Mostly tracks aerosols and water vapour.',
    },
    CLOUD_AMT: {
      name: 'Cloud cover',
      definition: 'Percent of the sky covered by cloud, estimated from satellites.',
      why: 'Shifts with circulation and moisture — but satellite cloud records are sensitive to changes in the satellites themselves. Be extra careful.',
    },
    WS2M: {
      name: 'Wind speed (2 m)',
      definition: 'Average wind speed 2 m above the ground.',
      why: 'Near-surface wind changes with large-scale circulation and with surface roughness (forests, buildings).',
    },
    WS10M: {
      name: 'Wind speed (10 m)',
      definition: 'Average wind speed 10 m above the ground — the standard weather-station height.',
      why: 'Same drivers as 2 m wind; less affected by small obstacles.',
    },
  } satisfies Record<VarCode, { name: string; definition: string; why: string }>,
  verdict: {
    label: {
      significant: 'Significant',
      suggestive: 'Suggestive',
      'not-significant': 'Not significant yet',
      insufficient: 'Insufficient data',
    } satisfies Record<Verdict, string>,
    explain: {
      significant: 'p < 0.05 — the evidence for a real trend is strong.',
      suggestive: '0.05 ≤ p < 0.10 — a hint of a trend, but not enough evidence yet.',
      'not-significant': 'p ≥ 0.10 — no significant trend detected for this period. That is not the same as “no change”.',
      insufficient: 'Not enough usable data to test for a trend.',
    } satisfies Record<Verdict, string>,
    headline: (o: { name: string; dir: 'risen' | 'fallen' | 'flat'; perDecade: string; since: number; total: string; from: number; to: number }) =>
      o.dir === 'flat'
        ? `${o.name} here has barely changed since ${o.since} (${o.perDecade} per decade).`
        : `${o.name} here has ${o.dir} by ${o.perDecade} per decade since ${o.since} (≈ ${o.total} over ${o.from}–${o.to}).`,
    chance: (p: number, significant: boolean) =>
      significant
        ? `A trend this strong would appear by chance ${pct(p)} of the time if there were no real change.`
        : `A trend at least this strong would appear by chance ${pct(p)} of the time even with no real change — so no significant trend was detected for this period.`,
    constant: 'This variable does not vary here (for example, there is never any snow), so there is nothing to test.',
  },
  stats: {
    title: 'Evidence',
    slope: 'Trend (OLS)',
    slopeCi: '95% confidence interval',
    total: 'Change over the period',
    pAdj: 'p-value (autocorrelation-adjusted)',
    pRaw: 'p-value (plain OLS)',
    plainOls: 'plain OLS',
    warningsLabel: 'Warnings',
    r2: 'R²',
    n: 'Years of data',
    nMonths: 'Months of data',
    r1: 'Lag-1 autocorrelation',
    nEff: 'Effective sample size',
    mk: 'Mann-Kendall test',
    mkTau: 'Kendall’s τ',
    sen: 'Sen’s slope',
    senCi: 'Sen 95% CI',
    smk: 'Seasonal Mann-Kendall',
    smkSlope: 'Seasonal Sen slope',
    snr: 'Signal-to-noise',
    snrHelp: 'Change over the period divided by the typical year-to-year wobble around the trend line.',
    mkModified: 'Modified MK (Hamed & Rao)',
    methods: 'How these numbers are computed',
    agree: 'OLS and Mann-Kendall agree.',
    disagreeSignificance:
      'The two tests disagree on significance. Mann-Kendall only looks at the order of values (robust to outliers), while OLS uses their size and is corrected here for autocorrelation. Borderline evidence often splits like this — treat it as “not settled”.',
    disagreeDirection:
      'OLS and Sen’s slope point in different directions. The series is probably dominated by a few unusual years; look at the chart before concluding anything.',
    basis: 'Analyse',
    basisAnnual: 'Yearly values',
    basisMonthly: 'Monthly anomalies',
    basisHelp:
      'Yearly values: one number per complete year (default). Monthly anomalies: every month minus its usual value — more points, but neighbouring months are more alike (higher autocorrelation).',
    period: 'Period',
    from: 'From',
    to: 'To',
    resetPeriod: 'Full record',
  },
  warnings: {
    'short-record': 'Short record (under 10 years): trends this short are easily dominated by natural ups and downs.',
    'too-few-points': 'Fewer than 5 data points — a trend test is not meaningful.',
    'strong-autocorrelation': 'Neighbouring values are strongly alike (high autocorrelation), so there is less independent evidence than the number of points suggests.',
    'degenerate-autocorrelation': 'Autocorrelation is so strong that the effective sample size is too small for a test.',
    'methods-disagree': 'The trend tests disagree — see the note below.',
    constant: 'This variable does not vary here.',
    'possible-step': 'This record looks more like a sudden jump than a steady trend. Sudden jumps often come from changes in instruments or data sources — investigate before trusting the trend.',
  } satisfies Record<WarningCode, string>,
  stepDetail: (year: number, size: string) => `Best-fitting jump: ${size} starting in ${year}.`,
  solarStep: 'Source changed in 2001 (SRB → CERES). Default period starts in 2001 to avoid an artificial jump.',
  solarStepActive: 'Your period includes the 2001 source change (SRB → CERES): part of any “trend” may be an artefact.',
  yts: {
    title: 'How many more years?',
    projection: (year: number) => `If this trend continues with the same year-to-year noise, it would likely become significant around ${year}.`,
    already: 'Already significant.',
    never: 'At this rate and noise level it would not become significant within 150 years — the trend is tiny compared with natural variability.',
    caveat:
      'This is a thought experiment, not a forecast: it assumes the slope, the noise and the autocorrelation stay exactly the same. Sometimes a trend just needs more data.',
  },
  chart: {
    title: 'Time series',
    raw: 'Monthly values',
    ma: '12-month mean',
    annual: 'Yearly mean',
    annualTotal: 'Yearly total ÷ days',
    trend: 'Trend',
    band: '95% confidence band',
    anomalies: 'Anomalies (remove seasonal cycle)',
    anomaliesShort: 'Anomalies',
    anomaliesSuffix: '(seasonal cycle removed)',
    trendBand: 'Trend + 95% band',
    zoomHint: 'Drag the handles below the chart (or use the From/To boxes) to choose a period — the statistics update instantly.',
    table: 'View as table',
    hideTable: 'Hide table',
    yearCol: 'Year',
    valueCol: 'Value',
    monthCol: 'Month',
    anomalyCol: 'Anomaly',
    unitsNote: (monthly: string, annual: string) => `Chart in ${monthly}; trends reported in ${annual}.`,
    empty: 'Pick a place and a variable to see its history.',
  },
  explore: {
    title: 'Explore',
    placeHeading: 'Place',
    searchPlaceholder: 'Search presets or type “lat, lon”…',
    latLabel: 'Latitude',
    lonLabel: 'Longitude',
    go: 'Go',
    presets: 'Quick picks',
    clickMap: 'Click anywhere on the globe to investigate that spot.',
    invalidCoords: 'Latitude must be between −90 and 90, longitude between −180 and 180.',
    gridNote: (coords: string, elev: string) => `${coords} · data for the ~50 km grid cell around this point · cell elevation ${elev}`,
    variableHeading: 'Variable',
    wizardButton: 'What should I investigate?',
    scanButton: 'Run Detective Scan',
    scanHint: 'Test all 19 variables here at once',
    loadingPlace: 'Fetching 45 years of NASA data for this spot…',
    errorTitle: 'Could not load data',
    errorBody: 'The NASA POWER service did not answer. Check your connection, or pick one of the quick picks — they work offline.',
    mapLayer: 'Map layer',
    layerBlueMarble: 'Blue Marble',
    layerModis: 'MODIS today',
    resultTitle: 'Verdict',
    whyChange: 'Why it may change',
    source: 'Source',
    show: 'Show',
    nearbyPlaces: 'Quick picks',
    morePresets: (n: number) => `+${n} more`,
  },
  wizard: {
    title: 'What are we investigating?',
    step: (i: number, n: number) => `Question ${i} of ${n}`,
    q1: 'Which kind of change interests you?',
    q2: 'Where?',
    q2help: 'Use the current spot, a quick pick, or type coordinates.',
    useCurrent: 'Use the current spot',
    q3: 'Over which period?',
    periods: {
      full: { label: 'Full record', help: '1981 → latest complete year' },
      recent30: { label: 'Last 30 years', help: 'A classic “climate normal” length' },
      satellite: { label: 'Satellite era', help: '2001 → now (best for sunlight & clouds)' },
    },
    resultTitle: 'Leads to follow',
    terrainIs: (t: string) => `This spot looks like: ${t}`,
    terrainBasis: (temp: string, precip: string, snow: string, elev: string) =>
      `Based on its 1981–present averages: ${temp}, ${precip}, snow ${snow}, elevation ${elev}.`,
    investigate: 'Investigate',
    noData: 'Load a place first to get tailored suggestions.',
  },
  terrain: {
    polar: { label: 'Polar / sub-polar', blurb: 'Long freezing winters; snow most of the year.' },
    mountain: { label: 'High mountains', blurb: 'High elevation, cold, snowy.' },
    desert: { label: 'Desert', blurb: 'Very little rain (< 250 mm a year).' },
    steppe: { label: 'Semi-arid steppe', blurb: 'Dry (250–500 mm a year), big seasonal swings.' },
    'tropical-humid': { label: 'Humid tropics', blurb: 'Hot and wet all year.' },
    'tropical-seasonal': { label: 'Seasonal tropics', blurb: 'Hot, with a wet and a dry season.' },
    boreal: { label: 'Cold continental', blurb: 'Cold winters with lasting snow.' },
    temperate: { label: 'Temperate', blurb: 'Moderate temperatures and rainfall.' },
  } satisfies Record<TerrainType, { label: string; blurb: string }>,
  scan: {
    title: 'Evidence board',
    subtitle: (n: number, place: string) => `${n} variables tested at ${place}, sorted by strength of evidence.`,
    run: 'Run Detective Scan',
    running: 'Testing every variable…',
    qValue: 'q-value',
    qHelp:
      'When you run 19 tests, a few “significant” results can appear by luck alone. The q-value (Benjamini–Hochberg) adjusts each p-value for the number of tests, controlling the share of false alarms among the discoveries. Verdicts on this board use q.',
    summary: (sig: number, sug: number, total: number) => `${sig} significant · ${sug} suggestive · ${total - sig - sug} not significant (after the multiple-testing correction)`,
    open: 'Open in chart',
    effect: 'Signal-to-noise',
    sortedBy: 'Sorted by verdict (after the correction); records that look like a sudden data jump come after clean ones; then by q-value and signal-to-noise.',
    exportCsv: 'Export results (CSV)',
    unadjusted: (v: string) => `Without the multiple-testing correction this would read “${v}”.`,
    perDecadeShort: '/decade',
    stepShort: 'Looks like a sudden jump — possibly a data-source change.',
    sparkLabel: (name: string) => `${name}: yearly values with trend line`,
  },
  trendMap: {
    title: 'Trend Map — where is it changing?',
    button: 'Trend Map',
    regionLabel: 'Region',
    current: 'Around the current spot (10° × 10°)',
    variable: 'Variable',
    run: 'Map the trends',
    running: (done: number, total: number) => `Testing ${done} of ${total} grid cells…`,
    legendSlope: (units: string) => `Sen’s slope (${units} per decade)`,
    legendSig: 'Dots = significant after FDR control (Wilks 2016, α = 0.10)',
    summary: (pos: number, neg: number, total: number) => `${pos} cells significantly up · ${neg} significantly down · ${total} cells tested`,
    clickCell: 'Click a cell to open its time series.',
    fdrHelp:
      'Testing hundreds of grid cells at once guarantees some false alarms. Following Wilks (2016) we only mark cells whose p-value passes the False Discovery Rate threshold (α_FDR = 0.10), so on average at most 10% of the marked cells are false alarms.',
    noneSig: 'No cell passes the FDR threshold — individually “significant” cells could easily be chance.',
    hide: 'Hide map overlay',
  },
  compare: {
    title: 'Compare two places',
    placeA: 'Place A',
    placeB: 'Place B',
    pick: 'Pick on map',
    diff: 'Difference in trends (B − A)',
    diffNote: (z: string, p: string) => `z = ${z}, p ≈ ${p} (difference of two independent slopes)`,
    sameAxes: 'Both charts share the same axes.',
    swap: 'Swap',
  },
  learn: {
    title: 'Learn',
    intro: 'How the detective works — in plain language.',
    glossary: 'Glossary',
    howTitle: 'How it works',
    methodsTitle: 'Methods (for the curious)',
    giovanniTitle: 'Bring your own data from NASA Giovanni',
    referencesTitle: 'References',
  },
  export: {
    title: 'Export & share',
    csvSeries: 'Series (CSV)',
    csvStats: 'Statistics (CSV)',
    png: 'Chart (PNG)',
    share: 'Copy share link',
    shareDone: 'Link copied — it reopens exactly this view.',
  },
  glossary: {
    trend: {
      term: 'Trend',
      def: 'A gradual, long-term change in one direction, separate from the ups and downs from year to year. Here: the slope of a straight line fitted through the yearly values.',
    },
    anomaly: {
      term: 'Anomaly',
      def: 'How far a value is from “normal” — here, a month’s value minus the average of that same calendar month over the period. Removes the seasonal cycle.',
    },
    'seasonal-cycle': {
      term: 'Seasonal cycle',
      def: 'The regular rise and fall that repeats every year (summer warm, winter cold). It is not a trend, so we remove it before looking for one.',
    },
    'p-value': {
      term: 'p-value',
      def: 'If there were really no trend, how often would random year-to-year noise alone produce a slope at least this steep? A small p means “chance alone would rarely do this”. It is NOT the probability that the trend is real.',
    },
    'confidence-interval': {
      term: 'Confidence interval',
      def: 'A range of plausible values for the true slope. If we repeated the whole experiment many times, 95% of such intervals would contain the true value.',
    },
    significance: {
      term: 'Statistical significance',
      def: 'We call a trend significant when p < 0.05: the observed change would be unusual (under 5%) if there were no real trend. Significant ≠ large or important; not significant ≠ no change.',
    },
    'mann-kendall': {
      term: 'Mann-Kendall test',
      def: 'A trend test that only asks “do later values tend to be higher (or lower) than earlier ones?”. It ignores the size of values, so a few extreme years cannot fool it.',
    },
    'sens-slope': {
      term: 'Sen’s slope',
      def: 'The median of the slopes between every pair of years. A robust alternative to the straight-line (OLS) slope that is not dragged around by outliers.',
    },
    reanalysis: {
      term: 'Reanalysis',
      def: 'A computer model of the atmosphere that is continuously corrected with real observations (satellites, weather stations, balloons) to reconstruct past weather everywhere. A very good estimate — but not a direct measurement.',
    },
    autocorrelation: {
      term: 'Autocorrelation',
      def: 'When one value resembles the next (a warm year followed by another warm one). Such data contain less independent information than their count suggests, so we widen the uncertainty (“effective sample size”).',
    },
    'effective-sample-size': {
      term: 'Effective sample size',
      def: 'How many truly independent observations the data are worth once autocorrelation is taken into account: n_eff = n·(1 − r₁)/(1 + r₁).',
    },
    'q-value': {
      term: 'q-value (FDR)',
      def: 'A p-value adjusted for running many tests at once. Controlling the False Discovery Rate keeps the share of false alarms among your “discoveries” low.',
    },
    'signal-to-noise': {
      term: 'Signal-to-noise',
      def: 'The total change implied by the trend divided by the typical year-to-year wobble. Above ~2 the trend stands out clearly from the noise.',
    },
    'step-change': {
      term: 'Step change',
      def: 'A sudden jump in a record. Real climate rarely jumps overnight; jumps often mean the instrument, satellite or data source changed.',
    },
    climatology: {
      term: 'Climatology',
      def: 'The long-term average conditions of a place — for example, the average January temperature over 1981–2025.',
    },
    ols: {
      term: 'Least-squares line (OLS)',
      def: 'The straight line that minimises the squared distances to the data points. Its slope is our main trend estimate.',
    },
  },
  footer: {
    power:
      'Data: NASA Langley Research Center’s Prediction Of Worldwide Energy Resources (POWER) project, funded through the NASA Earth Science Division — POWER Monthly and Annual API v2.10.0.',
    gibs: 'Imagery: NASA Global Imagery Browse Services (GIBS), part of NASA’s Earth Science Data and Information System (ESDIS).',
    disclaimer: 'Built for the NASA Space Apps Challenge. Not an official NASA product.',
  },
};

export type Dict = typeof en;
