# CLAUDE.md — Earth Trend Detective

Full brief: [`docs/SPEC.md`](docs/SPEC.md). Verified API facts: [`docs/DATA_NOTES.md`](docs/DATA_NOTES.md).
Decisions log: [`docs/DECISIONS.md`](docs/DECISIONS.md). Visual direction: [`docs/DESIGN.md`](docs/DESIGN.md).

## Key rules

- **Static frontend only.** No backend, no API keys, no paid services. All stats run in the browser.
- **Never invent data, parameters or endpoints.** Verify with real requests; record deviations in `docs/DECISIONS.md`.
- **Scientific honesty over flash.** Never write "there is no trend" — write "no significant trend detected for this period".
  p-value wording: "a trend this strong would appear by chance less than X% of the time if there were no real change".
- Verdicts: p < 0.05 SIGNIFICANT · 0.05 ≤ p < 0.10 SUGGESTIVE · else NOT SIGNIFICANT (YET).
- Reanalysis (MERRA-2) is model + assimilated observations, not a direct measurement. Say so.
- UI strings live in `src/content/i18n/en.ts` (single dictionary). No hardcoded user-facing English in components.
- `src/stats/` is pure TypeScript with no UI imports, fully tested against SciPy/pymannkendall fixtures (`scripts/make_fixtures.py`).
- Everything shown in Case Files lives in `public/data/demo/` (offline demo). Tour numbers are computed live; `src/content/cases.test.ts` guards every claim.
- No NASA logo (Space Apps rules).

## Commands

```bash
npm run dev        # Vite dev server
npm run lint       # ESLint + tsc --noEmit
npm test           # Vitest
npm run build      # production build
npm run smoke      # Playwright smoke test of dist/ (online + offline)
NODE_USE_ENV_PROXY=1 npm run prefetch   # re-download bundled POWER/GIBS data into public/data/demo
python3 scripts/make_fixtures.py   # regenerate stats fixtures
```

After every phase: `npm run lint && npm test && npm run build` must pass, then commit.
