# AGENT Log

Notes on agent work sessions. Each bullet can be upvoted/downvoted with (+1) or (-1) annotations appended over time.

- [2026-01-24] Created AGENT_log.md because it was missing; read AGENTS.md and CLAUDE.md for repo guidance; user only greeted, no task yet. (+1)
- [2026-01-24] Updated vault compare modal (scroll lock on open, column hover reveals remove X, header links open new tab with link-out icon, left-aligned values, strategies sorted by allocation, removed clear-selection button). Added `IconGitCompare` and used it on the Compare button. Adjusted filters button to show blue outline + text when active. Removed holdings chip on desktop (mobile only). Implemented new formatting helpers in `src/components/shared/utils/format.ts`: `formatApyDisplay`, `formatTvlDisplay`, `normalizeApyDisplayValue`; applied across APY/TVL/holdings/compare/tooltips. Important: APY values are stored as fractions (e.g., 0.40 for 40%); `formatApyDisplay` now multiplies by 100 so output matches expected percent, and sorting uses `normalizeApyDisplayValue` so order matches display. TVL compact formatting enforces 3 significant digits (e.g., `$7.00M`). Lint/build ran clean (build emits existing rollup warnings about /*#__PURE__*/ in deps and chunk size). (+1)
- [2026-01-24] Read AGENTS.md and AGENT_log.md per repo instructions; user greeted with "hello" and provided no task yet. (+1)
- [2026-01-24] Updated tooltip positioning to default above: `Tooltip` component default side now `top`, APY tooltip config uses `side: 'top'`, CSS `.tooltiptext` now anchors above with arrow flipped, added `.tooltip.bottom` override for below, and VaultRiskScoreTag tooltip classes switched to `bottom-full mb-1`. Tests not run. (+1)
- [2026-01-24] Moved vault header metric footnotes (TVL + user holdings) into tooltips by adding a `footnoteDisplay` option on `MetricsCard` and enabling it in `VaultDetailsHeader`. Avoided adding underline/cursor changes. (+1)

## Gotchas
- APY values are stored as fractions (0.40 == 40%); use `formatApyDisplay` (multiplies by 100) and `normalizeApyDisplayValue` for sort/display parity.
- TVL/holdings display uses `formatTvlDisplay` with 3 significant digits for compact notation (e.g., `$7.00M`), and 3–4 digits for sub-10k amounts.
- The app’s global CSS forces `html { overflow: auto !important; }`; modal scroll locks need to set `document.documentElement` overflow with `!important` if you want to fully block background scroll.
