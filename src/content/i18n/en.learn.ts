/** Learn page content (English). */
export const learnContent = {
  how: [
    {
      title: '1. Pick a suspect',
      body: 'Choose a place on the globe and a variable — air temperature, rain, snow, sunlight, wind… Not sure? “What should I investigate?” looks at the place’s climate (is it a desert? a mountain? the Arctic?) and suggests leads.',
    },
    {
      title: '2. Collect the evidence',
      body: 'The app asks NASA’s POWER service for monthly values from 1981 to the last complete year. They come from the MERRA-2 reanalysis (a weather model constantly corrected with satellite and ground observations) and, for sunlight and clouds, from satellite products (GEWEX SRB, then CERES).',
    },
    {
      title: '3. Remove the seasons',
      body: 'Summer is always warmer than winter — that is not a trend. We subtract each calendar month’s usual value (“anomalies”) and summarise each year by one number, so only the long-term change is left.',
    },
    {
      title: '4. Measure the change',
      body: 'A straight line through the yearly values gives the speed of change, shown per decade, plus a 95% confidence interval. Sen’s slope gives a second, outlier-proof estimate.',
    },
    {
      title: '5. Test it',
      body: 'Could random year-to-year noise alone produce such a slope? The t-test (corrected for autocorrelation) and the Mann-Kendall test answer with a p-value. p < 0.05 → SIGNIFICANT, 0.05–0.10 → SUGGESTIVE, otherwise NOT SIGNIFICANT (YET).',
    },
    {
      title: '6. Stay sceptical',
      body: 'Many tests at once create false alarms (we correct with q-values and FDR). Sudden jumps may be data artefacts (we warn you). Reanalysis is not a thermometer. A good detective reports what the evidence supports — no more.',
    },
  ],
  methods: [
    {
      title: 'Preprocessing',
      body: 'Fill values (−999) and physically impossible values are removed. Monthly anomaly = value − mean of the same calendar month over the analysis period. Yearly value = day-weighted mean of the 12 months (temperatures, humidity, wind, radiation, soil wetness, snow depth), Σ(mm/day × days) for precipitation (mm/yr), or the sum for frost days (days/yr). Incomplete years are skipped. Records shorter than 10 years get a warning; fewer than 5 points are not tested.',
      formula: 'anomaly(y, m) = x(y, m) − mean_y x(·, m)',
    },
    {
      title: 'Least-squares trend (OLS)',
      body: 'Slope b and intercept a minimise Σ(yᵢ − a − b·tᵢ)². Standard error SE(b) = s / √Σ(tᵢ − t̄)², with s² = Σeᵢ² / (n − 2). Test statistic t = b / SE(b), n − 2 degrees of freedom, two-sided p from Student’s t distribution; 95% CI = b ± t₀.₉₇₅ · SE(b).',
      formula: 't = b / SE(b),  CI₉₅ = b ± t₀.₉₇₅,df · SE(b)',
    },
    {
      title: 'Autocorrelation correction (Santer et al. 2000)',
      body: 'Neighbouring years are often alike. With lag-1 autocorrelation r₁ of the residuals, the effective sample size is n_eff = n(1 − r₁)/(1 + r₁) (capped at n). The standard error is inflated by √((n − 2)/(n_eff − 2)) and the t-test uses n_eff − 2 degrees of freedom. This corrected p is the one used for the verdict.',
      formula: 'n_eff = n · (1 − r₁) / (1 + r₁)',
    },
    {
      title: 'Mann-Kendall test',
      body: 'S = Σ_{i<j} sign(y_j − y_i). Var(S) = [n(n−1)(2n+5) − Σ t(t−1)(2t+5)]/18, where t are sizes of groups of tied values. Z = (S − 1)/√Var(S) if S > 0, (S + 1)/√Var(S) if S < 0 (continuity correction); two-sided p from the normal distribution; Kendall’s τ = S / [n(n−1)/2]. The modified test of Hamed & Rao (1998) inflates Var(S) for autocorrelation and is shown in the details.',
      formula: 'S = Σ sign(y_j − y_i),  Z = (S ∓ 1)/√Var(S)',
    },
    {
      title: 'Sen’s slope and its confidence interval',
      body: 'Sen’s slope is the median of all pairwise slopes (y_j − y_i)/(t_j − t_i). Its 95% interval follows Gilbert (1987): with C = z₀.₉₇₅ · √Var(S), the lower and upper limits are the M₁-th and (M₂+1)-th ordered slopes, M₁ = (N − C)/2, M₂ = (N + C)/2.',
      formula: 'β = median[(y_j − y_i)/(t_j − t_i)]',
    },
    {
      title: 'Seasonal Mann-Kendall (Hirsch et al. 1982)',
      body: 'Runs the Mann-Kendall test separately for each calendar month and adds up S and Var(S). Seasonal Sen slope = median of all within-month pairwise slopes. It uses the raw monthly data without removing the seasonal cycle.',
      formula: 'S = Σ_m S_m,  Var(S) = Σ_m Var(S_m)',
    },
    {
      title: 'Many tests at once',
      body: 'Detective Scan: Benjamini–Hochberg q-values, q_(i) = min_{k ≥ i} p_(k)·m/k. Trend Map: Wilks (2016) False Discovery Rate — a cell is significant if its p ≤ p_FDR = max{p_(i) : p_(i) ≤ (i/N)·α_FDR}, with α_FDR = 0.10.',
      formula: 'p_FDR = max{ p_(i) : p_(i) ≤ (i/N) · 0.10 }',
    },
    {
      title: 'Years to significance',
      body: 'Assuming the same slope, residual noise and r₁, we search the smallest record length N for which |b| / SE(N) exceeds the t critical value with n_eff(N) − 2 degrees of freedom. This is a thought experiment, not a forecast.',
      formula: 'SE(N) = s / √(N(N² − 1)/12) · √((N − 2)/(n_eff − 2))',
    },
    {
      title: 'Step-change check',
      body: 'We compare a straight line (2 parameters) with “one sudden jump” (two means + break year, 3 parameters) using the Bayesian Information Criterion. If the jump model wins by more than 10 BIC points, the record is flagged: such jumps often come from changes in instruments or data sources.',
      formula: 'ΔBIC = BIC_line − BIC_jump > 10',
    },
    {
      title: 'Site check (climate suitability score)',
      body: 'Draw an area and pick a building type. For every NASA grid cell inside the area (max 6) we compute 30-year statistics: hottest and coldest hour of the year, most humid month, frost days, wettest month, topsoil wetness, annual rain, deepest snow, mean wind, sunlight, plus 1981-present trends of the hottest hour and of rainfall. Each statistic becomes a 0–100 sub-score through a simple ramp (rules in src/content/siteRules.ts). The total is a weighted geometric mean with weights per building type (e.g. heat 25 % for hospitals, sunshine 50 % for solar plants). It is a climate screening only: earthquakes, slopes, flood zones, soils, roads and population are not included.',
      formula: 'score = 100 · exp( Σ wᵢ · ln(max(5, sᵢ)/100) )',
    },
  ],
  assumptions: [
    'Linearity: the straight line is a summary of the change, not a claim that change is perfectly steady.',
    'Independence: residuals are assumed independent after the AR(1) correction; longer memory (e.g. decades-long ocean cycles) can still make trends look more certain than they are.',
    'Homogeneity: the data source and method should be the same over the whole period. POWER’s solar and cloud data switch from GEWEX SRB to CERES in 2001, and we found an abrupt cloud-cover drop around 2017 over Central Asia — such jumps are not climate.',
    'Reanalysis is not a direct measurement: MERRA-2 values are model estimates for a ~50 km grid cell, guided by observations. Mountains, coasts and lakes are especially uncertain.',
    'Statistical significance is not importance: a tiny but steady change can be significant; a large but noisy one may not be — yet.',
  ],
  verification:
    'Every statistic in this app is implemented in TypeScript and checked by 130+ automated tests against SciPy (linregress, theilslopes, t and normal distributions, false_discovery_control) and pymannkendall (original, seasonal, Hamed–Rao tests) to 10⁻⁶ precision, on synthetic series and on a real NASA POWER series.',
  giovanni: [
    'Open NASA Giovanni (giovanni.gsfc.nasa.gov) and sign in with a free NASA Earthdata Login.',
    'Choose the plot type “Time Series, Area-Averaged”.',
    'Pick a date range and draw a box on the map (or type coordinates).',
    'Search a variable — e.g. MODIS aerosol optical depth, OMI NO₂, GPM IMERG monthly precipitation, GLDAS soil moisture or AIRS temperature — and click “Plot Data”.',
    'Under “Downloads”, save the CSV file.',
    'Drop the file into “Bring your own data” here: header lines are skipped, the date and value columns are detected automatically, fill values are removed, and daily data are averaged to months.',
  ],
  references: [
    'Benjamini, Y. & Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. J. Royal Statistical Society B, 57, 289–300.',
    'Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). Journal of Climate, 30, 5419–5454.',
    'Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring. Van Nostrand Reinhold.',
    'Hamed, K. H. & Rao, A. R. (1998). A modified Mann-Kendall trend test for autocorrelated data. Journal of Hydrology, 204, 182–196.',
    'Hirsch, R. M., Slack, J. R. & Smith, R. A. (1982). Techniques of trend analysis for monthly water quality data. Water Resources Research, 18, 107–121.',
    'Kendall, M. G. (1975). Rank Correlation Methods. Griffin, London.',
    'Mann, H. B. (1945). Nonparametric tests against trend. Econometrica, 13, 245–259.',
    'Santer, B. D. et al. (2000). Statistical significance of trends and trend differences in layer-average atmospheric temperature time series. J. Geophysical Research, 105(D6), 7337–7356.',
    'Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall’s tau. J. American Statistical Association, 63, 1379–1389.',
    'Wilks, D. S. (2016). “The stippling shows statistically significant grid points”: how research results are routinely overstated and overinterpreted, and what to do about it. Bull. American Meteorological Society, 97, 2263–2273.',
    'NASA POWER documentation: power.larc.nasa.gov/docs (data sources, API, referencing guide).',
    'NASA GIBS: Global Imagery Browse Services, part of NASA’s Earth Science Data and Information System (ESDIS).',
  ],
};
