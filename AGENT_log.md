# AGENT Log

Notes on agent work sessions. Each bullet can be upvoted/downvoted with (+1) or (-1) annotations appended over time.

- [2026-01-24] Created AGENT_log.md because it was missing; read AGENTS.md and CLAUDE.md for repo guidance; user only greeted, no task yet. (+1)
- [2026-01-24] Updated vault detail desktop layout: tabs selector now flush under header (removed spacer), tabs restyled to match inner-shadow selector buttons, VaultOverview metrics card loses bottom rounding via new MetricsCard className prop, and widget column top padding removed to align with user metrics. No tests run. (+1)
- [2026-01-24] Adjusted vault detail sticky offsets by measuring the header height with ResizeObserver and using it for the sticky top calculation, so the section selector/widget stop flush under the compressed header. No tests run. (+1)
- [2026-01-24] Made section scroll offsets dynamic: compute header height var, measure vault header + section selector heights via ResizeObserver, feed into scroll spy/scroll margin/scroll-to logic so active tab changes line up with sticky stack. No tests run. (+1)
- [2026-01-24] User requested to keep the APY disclaimer positioning change as-is (no revert). (+1)
- [2026-01-24] Updated vault compare modal (scroll lock on open, column hover reveals remove X, header links open new tab with link-out icon, left-aligned values, strategies sorted by allocation, removed clear-selection button). Added `IconGitCompare` and used it on the Compare button. Adjusted filters button to show blue outline + text when active. Removed holdings chip on desktop (mobile only). Implemented new formatting helpers in `src/components/shared/utils/format.ts`: `formatApyDisplay`, `formatTvlDisplay`, `normalizeApyDisplayValue`; applied across APY/TVL/holdings/compare/tooltips. Important: APY values are stored as fractions (e.g., 0.40 for 40%); `formatApyDisplay` now multiplies by 100 so output matches expected percent, and sorting uses `normalizeApyDisplayValue` so order matches display. TVL compact formatting enforces 3 significant digits (e.g., `$7.00M`). Lint/build ran clean (build emits existing rollup warnings about /*#__PURE__*/ in deps and chunk size). (+1)
- [2026-01-24] Read AGENTS.md and AGENT_log.md per repo instructions; user greeted with "hello" and provided no task yet. (+1)
- [2026-01-24] Updated tooltip positioning to default above: `Tooltip` component default side now `top`, APY tooltip config uses `side: 'top'`, CSS `.tooltiptext` now anchors above with arrow flipped, added `.tooltip.bottom` override for below, and VaultRiskScoreTag tooltip classes switched to `bottom-full mb-1`. Tests not run. (+1)
- [2026-01-24] Moved vault header metric footnotes (TVL + user holdings) into tooltips by adding a `footnoteDisplay` option on `MetricsCard` and enabling it in `VaultDetailsHeader`. Avoided adding underline/cursor changes. (+1)

## Gotchas

- APY values are stored as fractions (0.40 == 40%); use `formatApyDisplay` (multiplies by 100) and `normalizeApyDisplayValue` for sort/display parity.
- TVL/holdings display uses `formatTvlDisplay` with 3 significant digits for compact notation (e.g., `$7.00M`), and 3–4 digits for sub-10k amounts.
- The app’s global CSS forces `html { overflow: auto !important; }`; modal scroll locks need to set `document.documentElement` overflow with `!important` if you want to fully block background scroll.
- [2026-01-24] Moved the renderable section selector into VaultDetailsHeader (below vault metrics), passing tabs/active key/select handler and selector ref from the page; removed the old selector block from the details grid. Not yet re-run lint/build. (+1)
- [2026-01-24] Moved section selector into the same grid cell as VaultOverviewCard to remove the row gap; selector now stacked directly under metrics with zero vertical gap. Not yet re-run lint/build. (+1)
- [2026-01-24] Restored selector to its own grid row for compressed header while removing the expanded-view gap via conditional negative margin on the selector row. Not yet re-run lint/build. (+1)
- [2026-01-24] Removed row gap in VaultDetailsHeader grid by switching gap-6 to gap-0. Not yet re-run lint/build. (+1)
- [2026-01-24] Switched VaultDetailsHeader grid gap to `gap-y-0 gap-x-6` to keep column spacing while removing row gaps. Not yet re-run lint/build. (+1)
- [2026-01-24] Extracted the section selector buttons into a `SectionSelectorBar` function and used it in VaultDetailsHeader. Not yet re-run lint/build. (+1)
- [2026-01-24] Fixed selector bar stacking by moving the grid column span to the wrapper row and ensuring SectionSelectorBar is full width, so buttons lay out horizontally. Not yet re-run lint/build. (+1)
- [2026-01-24] Investigated isCompressed behavior in MetricsCard; noted it only toggles border class and may be visually subtle, and header compression depends on dev flag (collapsible mode). No code changes in this step. (+1)
- [2026-01-24] Lifted widget tab state to the vault detail page, added WidgetTabs export + controlled mode support, and rendered tabs under UserHoldingsCard in the header while hiding tabs inside the widget body. Not yet re-run lint/build. (+1)
- [2026-01-24] Lint/build: removed unused `nextSticky` and reordered imports; MetricsCard `isCompressed` made optional to fix portfolio usage; build succeeded with existing Rollup PURE comment warnings and chunk size warning. (+1)
- [2026-01-24] Disabled scroll-spy updates during programmatic scroll-to (tracks target and re-enables after reach/timeout) and stabilized section selector button borders with transparent base border + removed focus ring to stop flicker. Not yet re-run lint/build. (+1)
- [2026-01-24] Fixed active tab border visibility by forcing `!border-border` to override base `border-transparent` in section selector buttons. Not yet re-run lint/build. (+1)
- [2026-01-24] Applied the same border-stabilizing pattern to widget tabs (base transparent border + !border-border when active) to prevent flicker. Not yet re-run lint/build. (+1)
