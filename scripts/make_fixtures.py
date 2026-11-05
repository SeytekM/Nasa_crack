#!/usr/bin/env python3
"""
Generate reference values for the TypeScript stats module.

Reference implementations:
  * scipy.stats.linregress, theilslopes, t, norm, false_discovery_control
  * scipy.special.betainc, gammaln
  * pymannkendall.original_test, seasonal_test, sens_slope, hamed_rao_modification_test
  * independent NumPy re-implementations of the AR(1) adjustment (Santer et al. 2000),
    Wilks (2016) FDR and years-to-significance (no counterpart in SciPy).

Usage:  pip install scipy pymannkendall numpy
        python3 scripts/make_fixtures.py
Writes: src/stats/__fixtures__/fixtures.json
"""
from __future__ import annotations

import calendar
import json
import math
import os
import urllib.request

import numpy as np
import pymannkendall as mk
from scipy import special, stats

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "src", "stats", "__fixtures__")
RAW_POWER = os.path.join(OUT_DIR, "power_bishkek_raw.json")
POWER_URL = (
    "https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR"
    "&community=AG&longitude=74.6&latitude=42.9&start=1981&end=2025&format=JSON"
)


def clean(v):
    """JSON-safe floats (NaN/inf -> None)."""
    if isinstance(v, (list, tuple, np.ndarray)):
        return [clean(x) for x in v]
    if isinstance(v, (np.floating, float)):
        v = float(v)
        return v if math.isfinite(v) else None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


# ---------------------------------------------------------------- references
def ols_ref(x, y):
    m = np.isfinite(x) & np.isfinite(y)
    x, y = x[m], y[m]
    r = stats.linregress(x, y)
    n = len(x)
    df = n - 2
    tc = stats.t.ppf(0.975, df)
    resid = y - (r.intercept + r.slope * x)
    return dict(
        n=n, slope=r.slope, intercept=r.intercept, r=r.rvalue, p=r.pvalue, se=r.stderr,
        interceptSe=r.intercept_stderr, ciLow=r.slope - tc * r.stderr, ciHigh=r.slope + tc * r.stderr,
        residualSd=math.sqrt(np.sum(resid ** 2) / df),
    )


def ar1_ref(x, y, step):
    """Santer et al. (2000) adjustment, re-implemented independently in NumPy."""
    m = np.isfinite(x) & np.isfinite(y)
    x, y = x[m], y[m]
    r = stats.linregress(x, y)
    e = y - (r.intercept + r.slope * x)
    n = len(e)
    consecutive = np.abs(np.diff(x) - step) <= step * 1e-6
    r1 = np.sum((e[:-1] * e[1:])[consecutive]) / np.sum(e ** 2)
    n_eff = n if r1 <= 0 else n * (1 - r1) / (1 + r1)
    df = n_eff - 2
    se = r.stderr * math.sqrt((n - 2) / df)
    t = r.slope / se
    p = 2 * stats.t.sf(abs(t), df)
    tc = stats.t.ppf(0.975, df)
    return dict(r1=r1, nEff=n_eff, se=se, df=df, t=t, p=p, ciLow=r.slope - tc * se, ciHigh=r.slope + tc * se)


def band_ref(x, y, xs, step):
    m = np.isfinite(x) & np.isfinite(y)
    x, y = x[m], y[m]
    n = len(x)
    r = stats.linregress(x, y)
    e = y - (r.intercept + r.slope * x)
    s = math.sqrt(np.sum(e ** 2) / (n - 2))
    sxx = np.sum((x - x.mean()) ** 2)
    a = ar1_ref(x, y, step)
    infl = (n - 2) / a["df"]
    tc = stats.t.ppf(0.975, a["df"])
    yhat = r.intercept + r.slope * xs
    half = tc * s * math.sqrt(infl) * np.sqrt(1 / n + (xs - x.mean()) ** 2 / sxx)
    return dict(x=xs, fit=yhat, low=yhat - half, high=yhat + half)


def mk_ref(y):
    res = mk.original_test(y)
    return dict(n=int(np.sum(np.isfinite(y))), s=res.s, varS=res.var_s, z=res.z, p=res.p, tau=res.Tau,
                senSlope=res.slope, senIntercept=res.intercept)


def mk_hr_ref(y):
    res = mk.hamed_rao_modification_test(y)
    return dict(s=res.s, varS=res.var_s, z=res.z, p=res.p, tau=res.Tau)


def sen_ref(x, y):
    m = np.isfinite(x) & np.isfinite(y)
    res = stats.theilslopes(y[m], x[m], 0.95)
    return dict(slope=res.slope, intercept=res.intercept, ciLow=res.low_slope, ciHigh=res.high_slope)


def smk_ref(matrix):
    flat = np.asarray(matrix, dtype=float).ravel()
    res = mk.seasonal_test(flat, period=12)
    return dict(s=res.s, varS=res.var_s, z=res.z, p=res.p, tau=res.Tau, slope=res.slope)


def wilks_ref(ps, alpha_fdr=0.1):
    ps = np.asarray(ps, dtype=float)
    finite = np.sort(ps[np.isfinite(ps)])
    N = len(finite)
    ok = finite <= (np.arange(1, N + 1) / N) * alpha_fdr
    thr = finite[ok].max() if ok.any() else 0.0
    sig = [bool(np.isfinite(p) and thr > 0 and p <= thr) for p in ps]
    return dict(threshold=thr, significant=sig, nSignificant=int(sum(sig)))


def yts_ref(b, s, r1, n, dt, first, alpha=0.05, horizon=150):
    r1 = r1 if r1 > 0 else 0.0
    for N in range(n, n + math.ceil(horizon / dt) + 1):
        n_eff = N if r1 <= 0 else N * (1 - r1) / (1 + r1)
        df = n_eff - 2
        if df <= 0:
            continue
        sxx = dt * dt * N * (N * N - 1) / 12
        se = s / math.sqrt(sxx) * math.sqrt((N - 2) / df)
        if abs(b) / se > stats.t.ppf(1 - alpha / 2, df):
            return dict(nNeeded=N, year=first + (N - 1) * dt, extraYears=(N - n) * dt)
    return None


def series_case(name, x, y, step):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    o = ols_ref(x, y)
    a = ar1_ref(x, y, step)
    m = np.isfinite(y)
    first = float(x[m][0])
    xs = np.linspace(x[m][0], x[m][-1], 7)
    return dict(
        name=name, step=step, x=x, y=y,
        ols=o, ar1=a, band=band_ref(x, y, xs, step),
        mk=mk_ref(y), mkHamedRao=mk_hr_ref(y), sen=sen_ref(x, y),
        yts=yts_ref(o["slope"], o["residualSd"], a["r1"], o["n"], step, first),
    )


# ---------------------------------------------------------------- data
def ar1_noise(rng, n, phi, sigma):
    e = np.zeros(n)
    e[0] = rng.normal(0, sigma / math.sqrt(1 - phi * phi))
    for i in range(1, n):
        e[i] = phi * e[i - 1] + rng.normal(0, sigma)
    return e


def load_power():
    try:
        with urllib.request.urlopen(POWER_URL, timeout=60) as r:
            raw = json.loads(r.read().decode())
        with open(RAW_POWER, "w") as f:
            json.dump(raw, f)
        print("fetched live POWER data")
    except Exception as exc:  # noqa: BLE001
        print(f"POWER fetch failed ({exc}); using cached {RAW_POWER}")
        with open(RAW_POWER) as f:
            raw = json.load(f)
    return raw


def power_monthly(raw, code):
    d = raw["properties"]["parameter"][code]
    recs = []
    for k in sorted(d):
        mth = int(k[4:])
        if mth == 13:
            continue
        v = d[k]
        recs.append((int(k[:4]), mth, float("nan") if v == raw["header"]["fill_value"] else float(v)))
    return recs


def annual(recs, agg):
    out = {}
    for y, m, v in recs:
        out.setdefault(y, []).append((m, v))
    years, vals = [], []
    for y in sorted(out):
        ms = out[y]
        if len(ms) < 12 or any(not math.isfinite(v) for _, v in ms):
            continue
        days = np.array([calendar.monthrange(y, m)[1] for m, _ in ms], dtype=float)
        v = np.array([v for _, v in ms])
        years.append(y)
        vals.append(float(np.sum(v * days) / np.sum(days)) if agg == "mean" else float(np.sum(v * days)))
    return years, vals


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    rng = np.random.default_rng(20261105)

    # --- special functions
    special_cases = dict(
        betainc=[dict(a=a, b=b, x=x, v=special.betainc(a, b, x))
                 for a, b, x in [(0.5, 0.5, 0.3), (2, 3, 0.4), (10, 0.5, 0.9), (21.5, 0.5, 0.2), (250, 0.5, 0.99),
                                 (1.7, 4.2, 0.05), (30, 30, 0.5), (0.3, 7, 0.999)]],
        tSf=[dict(t=t, df=df, v=stats.t.sf(t, df))
             for t, df in [(0.0, 5), (1.0, 1), (2.0, 3), (-1.5, 10), (2.5, 43), (4.0, 12.7), (8.0, 538), (0.3, 2.2),
                           (-3.3, 100), (6.0, 25), (12.0, 40)]],
        tPpf=[dict(p=p, df=df, v=stats.t.ppf(p, df))
              for p, df in [(0.975, 1), (0.975, 2), (0.975, 5), (0.975, 10.5), (0.975, 43), (0.975, 538), (0.95, 3),
                            (0.025, 7), (0.999, 4), (0.6, 20), (0.995, 2.3)]],
        normCdf=[dict(z=z, v=stats.norm.cdf(z)) for z in [-8, -3.3, -1.96, -0.5, 0, 0.7, 1.645, 2.576, 5]],
        normSf=[dict(z=z, v=stats.norm.sf(z)) for z in [0, 1, 3, 6, 9, 12]],
        normPpf=[dict(p=p, v=stats.norm.ppf(p)) for p in [1e-10, 0.001, 0.025, 0.1, 0.5, 0.8, 0.975, 0.999999]],
        lnGamma=[dict(x=x, v=special.gammaln(x)) for x in [0.1, 0.5, 1, 1.5, 3.7, 10, 100.5, 1000]],
    )

    # --- synthetic series
    cases = []
    t = np.arange(1981, 2026, dtype=float)
    cases.append(series_case("trend", t, 0.03 * (t - 1981) + rng.normal(0, 0.5, t.size), 1))
    t40 = np.arange(1985, 2025, dtype=float)
    cases.append(series_case("no-trend", t40, rng.normal(10, 1, t40.size), 1))
    t30 = np.arange(1990, 2020, dtype=float)
    cases.append(series_case("ties", t30, np.round(rng.normal(5, 1.2, t30.size) + 0.02 * (t30 - 1990)), 1))
    y_gap = 0.02 * (t - 1981) + rng.normal(0, 0.4, t.size)
    y_gap[[3, 4, 17, 30, 44]] = np.nan
    cases.append(series_case("gaps", t, y_gap, 1))
    t60 = np.arange(1960, 2020, dtype=float)
    cases.append(series_case("autocorrelated", t60, 0.01 * (t60 - 1960) + ar1_noise(rng, t60.size, 0.6, 0.3), 1))
    t8 = np.arange(2010, 2018, dtype=float)
    cases.append(series_case("short", t8, np.array([1.2, 0.8, 1.5, 1.1, 1.9, 1.4, 2.2, 1.7]), 1))
    tn = np.arange(1981, 2026, dtype=float)
    cases.append(series_case("negative-trend", tn, 100 - 0.4 * (tn - 1981) + rng.normal(0, 4, tn.size), 1))

    # monthly synthetic with seasonality + trend + gaps
    years = np.arange(1991, 2021)
    months = np.tile(np.arange(1, 13), years.size)
    yrs = np.repeat(years, 12)
    season = 10 * np.sin(2 * np.pi * (months - 4) / 12)
    ym = season + 0.025 * (yrs - 1991 + (months - 0.5) / 12) + ar1_noise(rng, yrs.size, 0.3, 0.8)
    ym = np.round(ym, 2)
    ym[[5, 100, 101, 250]] = np.nan
    matrix = ym.reshape(years.size, 12)
    seasonal = dict(name="seasonal-synthetic", years=years, matrix=matrix, smk=smk_ref(matrix))

    # --- real POWER series (Bishkek)
    raw = load_power()
    t2m = power_monthly(raw, "T2M")
    pr = power_monthly(raw, "PRECTOTCORR")
    ya, va = annual(t2m, "mean")
    cases.append(series_case("power-bishkek-t2m-annual", ya, va, 1))
    yp, vp = annual(pr, "rateSum")
    cases.append(series_case("power-bishkek-precip-annual", yp, vp, 1))
    # monthly anomalies of T2M
    vals = np.array([v for _, _, v in t2m])
    mths = np.array([m for _, m, _ in t2m])
    clim = np.array([np.nanmean(vals[mths == k]) for k in range(1, 13)])
    anom = vals - clim[mths - 1]
    tdec = np.array([y + (m - 0.5) / 12 for y, m, _ in t2m])
    cases.append(series_case("power-bishkek-t2m-monthly-anomalies", tdec, anom, 1 / 12))
    power_seasonal = dict(
        name="power-bishkek-t2m-seasonal", years=sorted({y for y, _, _ in t2m}),
        matrix=vals.reshape(-1, 12), smk=smk_ref(vals.reshape(-1, 12)),
    )
    # 2x12 centred moving average reference
    ma = np.full(vals.size, np.nan)
    w = np.r_[0.5, np.ones(11), 0.5] / 12
    for i in range(6, vals.size - 6):
        ma[i] = np.sum(vals[i - 6:i + 7] * w)
    power_preproc = dict(
        climatology=clim, annualMean=dict(years=ya, values=va), annualRateSum=dict(years=yp, values=vp),
        movingAverage=ma[:60],
    )

    # --- multiple comparisons
    ps_bh = np.array([0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216, 0.222, 0.251, 0.269, 0.275,
                      0.34, 0.341, 0.384, 0.569, 0.594, 0.696, 0.762, 0.94, 0.942, 0.975, 0.986])
    ps_rand = rng.uniform(0, 1, 50) ** 3
    fdr = dict(
        bh=[dict(p=ps_bh, q=stats.false_discovery_control(ps_bh, method="bh")),
            dict(p=ps_rand, q=stats.false_discovery_control(ps_rand, method="bh"))],
        wilks=[dict(p=ps_bh, **wilks_ref(ps_bh)), dict(p=ps_rand, **wilks_ref(ps_rand)),
               dict(p=np.array([0.5, 0.6, 0.9]), **wilks_ref([0.5, 0.6, 0.9]))],
    )

    # --- years to significance grid
    yts_cases = []
    for b, s, r1, n, dt in [(0.02, 0.5, 0.1, 30, 1), (0.005, 0.4, 0.3, 45, 1), (-0.03, 1.2, 0.0, 20, 1),
                            (0.001, 1.0, 0.2, 45, 1), (0.02, 0.9, 0.5, 540, 1 / 12), (0.1, 0.2, 0.0, 10, 1)]:
        yts_cases.append(dict(b=b, s=s, r1=r1, n=n, dt=dt, first=1981.0, result=yts_ref(b, s, r1, n, dt, 1981.0)))

    out = dict(
        generator="scripts/make_fixtures.py",
        versions=dict(numpy=np.__version__, scipy=__import__("scipy").__version__, pymannkendall=mk.__version__),
        special=special_cases, series=cases, seasonal=[seasonal, power_seasonal], fdr=fdr, yts=yts_cases,
        powerPreproc=power_preproc,
    )

    def walk(o):
        if isinstance(o, dict):
            return {k: walk(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [walk(v) for v in o]
        if isinstance(o, np.ndarray):
            return walk(o.tolist())
        return clean(o)

    with open(os.path.join(OUT_DIR, "fixtures.json"), "w") as f:
        json.dump(walk(out), f, indent=1)
    print("wrote", os.path.join(OUT_DIR, "fixtures.json"))


if __name__ == "__main__":
    main()
