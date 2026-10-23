# Lifetime landing concept

An isolated, buildless concept served at `/concepts/lifetime/`. The existing homepage is unchanged. Uses the repository's Aeonik fonts and Yearn mark; no new dependencies.

- `?hero=tagline`: the counter with the subordinate “Deposit once. Earn forever.” line.
- `?hero=counter`: the counter without the tagline. The floating control is for design review.
- Scroll sequence: earnings hero → one statistics section (yield, TVL, fees, deployed vaults, harvests) → depositor/builder paths. No deposit widget or invented lifetime flow.
- Depositors go to the existing vault explorer; builders go to the V3 developer overview.

## Data and motion

`data.json` is a captured read-only response from the Yearn Data Neon-backed API, fetched October 20, 2026. It retains publication/dataset IDs and source paths. Earnings summary, weekly history and prior cumulative total were checked to belong to the same dataset. TVL has its own recorded observation date.

Earnings use `netLifetimeEarningsUsd`: incident-adjusted reported P&L, including active and retired history, not consolidated economic yield or depositor net profit. Fees use `totalFeesPaidUsd`: known gross contract fees, not treasury receipts. TVL uses the published `totalTvl`, retaining its source exclusions. The data notes explain these scopes. Missing data is unavailable, never a synthetic zero.

The two cumulative earnings points span October 5–12. Their difference divided by elapsed seconds determines the estimated pace. The counter uses `current.earningsUsd + rate * max(0, Date.now() / 1000 - current.timestamp)`, anchored to the timestamped October 12 point rather than the later untimestamped headline total. It extrapolates beyond recorded observations and is visibly labeled as estimated. The headline snapshot remains in the data notes.

Reloads and windows with the same source data and device clock calculate the same value; animation frames only determine when it is painted. Hidden pages cancel their frame loop. Visibility, focus and page restoration repaint from the current timestamp and start a single loop. Invalid or nonpositive rates fall back to the recorded headline total. The counter alone overrides reduced motion; assistive technology receives an estimate refreshed on lifecycle events instead of per frame.

This mockup assumes the historical rate continues indefinitely. Before production, confirm and refresh source points, define an estimate horizon and stale-data behavior, and use server clock calibration if consistency across devices with incorrect clocks is required. Historical yield consolidation remains a separate data-accounting decision.

## Preview

From the repository root:

```sh
python3 -m http.server 4791 --bind 127.0.0.1 --directory apps/yearn/public
```

Open `/concepts/lifetime/`. The ordinary Next app also serves this public directory. No credentials or database access are needed in the browser.

## Activity counts

The October 21 read-only Neon capture records 732 Yearn-managed vaults (639 V2, 93 V3) and 97,278 StrategyReported events (81,316 V2, 15,962 V3). Harvest events use the earnings publication cutoff, October 15, 2026 00:00 UTC (exclusive), and their chain/transaction/log identity; they are not unique transaction counts. All counted reports resolve to vault inventory metadata. Vaults include active and retired inventory, excluding standalone Tokenized Strategies. These are known indexed counts; the source does not certify exhaustive historical discovery. The capture and version breakdowns are retained in data.json.

## Deposited value and shared earnings counter

The deposited-value snapshot was refreshed from `https://yearn-data-api-preview.vercel.app/api/tvl`, the default hosted data target in Powerglove. Its TVL overview renders `totalTvl` directly; the concept now captures the same $208,172,781.1714352 response. Source URL, field, capture time and observation boundary are stored in `tvlSource`. This remains a captured snapshot rather than a live feed. The requested “in Yearn Endorsed vaults” display copy does not introduce an endorsed-only filter: the API aggregate retains its existing categories, retired holdings, overlap and bridge accounting.

Hero and statistics earnings are painted from the same value on every animation frame, with two decimal places in the hero and whole dollars in the statistics, including tab restoration and reduced motion.

## Integrations strip

The 15 partner names and SVG assets come from `yearn/yPartners` at `6fcda70f31e9df622420b6f328778c4cd3f8dd62`, specifically `components/SectionPartnerLogos.tsx` and `public/partner-logos-dark/`. `partners.json` preserves the source and list; the upstream license is included at `partners/LICENSE.txt`. The source repository is cloned at `/home/dev/raaaws/yPartners`. This curated marketing list is not a live integration audit. No partner financial or performance claims are copied. The Curve SVG style CDATA wrapper is normalized for Biome; logo geometry is unchanged.

The strip scrolls continuously, pauses on hover/focus, and becomes a manually scrollable single list for reduced motion. The duplicate visual list is inert and hidden from assistive technology.

## Shared landing navigation

The fixed, blurred 68px header follows `PublicHeader.tsx` and uses SVG markup rendered directly from `TypeMarkYearn.tsx`. Ecosystem and Resources copy, destinations and grouping come from `HeaderNavMenu.tsx`; app-relative links resolve to yearn.fi. Icons are rendered from the existing icon components or reference existing public assets. The static concept mirrors the menu data rather than mounting the app's React provider tree. Keep this captured menu in sync when the application header changes.

The mobile header uses two rows to retain both menus and all three concept actions. Menus support hover, click-to-pin, keyboard navigation, Escape and outside-click dismissal.


### Interactive security panels

Five compact buttons switch panels on pointer hover, focus, or tap. The default panel quotes the V3 `deposit` function at commit `89ab996bf94a16878e174e50e9862d69c6495875`, linked to the exact source lines. Auditor marks are from ChainSecurity's official website and yaudit.dev; selected reports link to yearn-security (V3 2023 and V3.1.0 2026).

Monitoring reads `https://curation.yearn.fi/api/monitoring/alerts?limit=3`, the API used by Curation's own monitor page. It refreshes every minute while the panel and document are visible. Failed requests fall back to the bundled dated snapshot, explicitly labeled as such; a missing snapshot shows unavailable. Alert text is rendered as text, never HTML. Reports link to Yearn Curation assessments rather than implying insurance coverage.

The circuit breaker panel is an explicitly illustrative observe/evaluate/respond flow, linked to the actual V3 shutdown function. It does not claim a live trigger, or that all vaults have automated shutdown configured.


Security iteration: fixed 440px panel height prevents selection layout shifts. The entire pinned VaultV3 source is included (also in security/VaultV3.vy) with keyboard-scrollable code. Added official Statemind logo and V3.0.2 audit. Alerts show clean first-line event titles without emojis. Circuit breaker statuses are deliberately simulated, not connected to live controls. Reports and displayed scores are a dated Oct 22 snapshot in security/reports.json; unscored reports retain that distinction. The report list scrolls manually, with each entry linked to its source.

Security iteration 19: monitoring requests 20 alerts with protocol/action/date columns. Underwriting uses reviewed item/risk level/score rows. Both scroll vertically at a steady pace, pause on hover/focus/manual interaction, and remain static for reduced motion. Contract highlighting is static and minimal; the full source wraps without horizontal overflow. Added the Trail of Bits V2 audit (2021) and their official mark, displayed monochrome.


The branch now serves this static landing at `/` through a Next.js beforeFiles rewrite. Absolute asset URLs also preserve the original `/concepts/lifetime/` review route. The existing React homepage is bypassed, while app routes remain unchanged. The concept retains its noindex directive and snapshot/demo data; production data and SEO integration remain separate work.
