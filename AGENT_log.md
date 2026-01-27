# AGENT Log

Notes on agent work sessions. Each bullet can be upvoted/downvoted with (+1) or (-1) annotations appended over time.

- [2026-01-24] Created AGENT_log.md because it was missing; read AGENTS.md and CLAUDE.md for repo guidance; user only greeted, no task yet. (+1)
- [2026-01-24] Updated vault detail desktop layout: tabs selector now flush under header (removed spacer), tabs restyled to match inner-shadow selector buttons, VaultOverview metrics card loses bottom rounding via new MetricsCard className prop, and widget column top padding removed to align with user metrics. No tests run. (+1)
- [2026-01-24] Adjusted vault detail sticky offsets by measuring the header height with ResizeObserver and using it for the sticky top calculation, so the section selector/widget stop flush under the compressed header. No tests run. (+1)
- [2026-01-24] Made section scroll offsets dynamic: compute header height var, measure vault header + section selector heights via ResizeObserver, feed into scroll spy/scroll margin/scroll-to logic so active tab changes line up with sticky stack. No tests run. (+1)
- [2026-01-24] User requested to keep the APY disclaimer positioning change as-is (no revert). (+1)
