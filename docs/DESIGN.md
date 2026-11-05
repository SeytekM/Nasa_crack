# DESIGN — "Night shift at the observatory"

The user is a detective on the night shift in an Earth-observation control
room: a dark desk, a glowing globe, case folders, and a rubber stamp for the
verdict. The metaphor frames the *reasoning* (evidence → test → verdict); it
never replaces the numbers.

## Principles

1. **The number is the hero.** Every screen answers *what changes, where, how
   much, is it significant* in one sentence before any chart.
2. **Evidence strength ≠ direction.** Direction uses a diverging palette
   (warming red / cooling blue, wetter teal / drier brown). Evidence strength
   uses the stamp (filled / dashed / dotted outline + text). Never colour alone.
3. **Recessive chrome.** Hairlines, generous padding, thin marks. Saturation is
   reserved for data.
4. **Honest provenance everywhere.** Every dataset shows `LIVE`, `CACHED` or
   `BUNDLED`, and every variable shows its source type (reanalysis / satellite).

## Type

| Role | Face | Notes |
|---|---|---|
| UI & prose | **Inter** (variable, self-hosted via @fontsource) | 15–16 px body, 1.55 line-height |
| Numbers, codes, stamps, axis ticks | **IBM Plex Mono** 400/500/600 | `tabular-nums` only in tables and ticks |
| Wordmark | Plex Mono 600, letter-spaced caps | "EARTH TREND DETECTIVE" |

## Colour tokens

Defined once in `src/styles/index.css` as CSS custom properties on `:root`
(dark default) and `[data-theme="light"]` (projector theme). Dark mode is the
default because the demo starts on a glowing globe; the light theme is tuned
for washed-out projectors (higher contrast, thicker lines).

| Token | Dark | Light |
|---|---|---|
| `--bg` page | `#070b14` | `#f4f2ec` (warm paper) |
| `--surface-1` panels | `#0d1422` | `#ffffff` |
| `--surface-2` raised | `#131c2e` | `#f9f8f4` |
| `--line` hairline | `#1f2a40` | `#dcd9cf` |
| `--ink-1` primary text | `#e8edf6` | `#111827` |
| `--ink-2` secondary | `#a7b2c6` | `#3f4656` |
| `--ink-3` muted | `#7d89a0` | `#5f6676` |
| `--accent` brand/focus | `#5cc8ff` | `#0b63c5` |

### Chart series (validated with the dataviz validator, both modes PASS)

| Series | Dark | Light | Mark |
|---|---|---|---|
| Monthly values (context) | `--ink-3` @ 55 % | `--ink-3` @ 45 % | 1 px line |
| 12-month mean | `#2a9fd8` | `#1d6fd8` | 2 px line |
| Annual mean | `#a36fe0` | `#7c3aed` | 8 px dots, 2 px surface ring |
| Trend + 95 % band | `#d07a0a` | `#b86200` | 2 px line, band 16 % alpha |

Dark: L 0.48–0.67, worst adjacent CVD ΔE 23.9, normal-vision ΔE 27.5.
Light: worst adjacent CVD ΔE 27.7, normal-vision ΔE 31.6. All ≥ 3:1 contrast.

### Diverging trend palettes (ColorBrewer, colour-blind safe, 9 classes)

| Family | Variables | Negative pole → positive pole |
|---|---|---|
| temperature | T2M, TS, T2M_MAX/MIN/RANGE, T2MDEW (FROST_DAYS inverted) | blue `#2166ac` → red `#b2182b` (RdBu) |
| moisture | PRECTOTCORR, RH2M, QV2M, GWET*, SNODP | brown `#8c510a` → teal `#01665e` (BrBG) |
| neutral | wind, solar, cloud | orange `#b35806` → purple `#542788` (PuOr) |

Midpoint is a neutral grey (dark `#3a4254`, light `#f0efec`). On the Trend Map,
significant cells (Wilks FDR) are additionally **stippled with dots**; the
legend explains both channels.

### Evidence stamp

| Verdict | Stamp style | Text |
|---|---|---|
| SIGNIFICANT | solid double border, filled tint, ✓ glyph | "SIGNIFICANT" |
| SUGGESTIVE | dashed border, ~ glyph | "SUGGESTIVE" |
| NOT SIGNIFICANT (YET) | dotted border, muted ink, ? glyph | "NOT SIGNIFICANT YET" |
| INSUFFICIENT DATA | thin border, muted | "INSUFFICIENT DATA" |

The stamp is rotated −4°, Plex Mono 600 caps; it "lands" with a 220 ms
scale-and-settle animation (disabled under `prefers-reduced-motion`).

## Layout

* **Top bar:** wordmark · mode tabs (Explore / Case Files / Compare / Learn) ·
  theme toggle · data-source chip.
* **Explore (≥ 1024 px):** left 42 % globe (MapLibre globe projection, GIBS Blue
  Marble + labels) with place search, presets and lat/lon; right 58 % analysis
  column: variable picker → variable card → chart → verdict & statistics.
  Detective Scan opens the *evidence board* as a full-width drawer.
* **Mobile:** single column; the map collapses to a 40 vh strip.
* **Case Files:** manila-tinted folder tabs on the dark desk; a tour card floats
  bottom-left with Back / Next and highlights the referenced UI element with a
  soft glowing outline.

## Motion

Only meaningful motion: chart redraw transitions (300 ms), count-up numbers in
evidence cards (400 ms), stamp landing (220 ms), globe fly-to. Everything is
disabled when `prefers-reduced-motion: reduce`.

## Accessibility

WCAG AA contrast on both themes; all controls keyboard-reachable with visible
focus rings (`--accent`, 2 px offset); glossary terms are focusable buttons
with tooltips (`aria-describedby`); charts have a data-table alternative
(CSV export + "View as table"); significance is never encoded by colour alone.
