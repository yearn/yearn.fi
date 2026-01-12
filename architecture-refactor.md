# Architectural Refactor

Below is a structured, codebase-grounded streamlining report focused on removing the “multi-app” legacy, consolidating v2/v3/nextgen into a single Vaults feature area, and eliminating duplicated or obsolete utilities/architecture.

---

## 1) Current state: what you actually have today

At a high level the repo is split into:

* `src/` – app bootstrapping and global shell (`main.tsx`, `App.tsx`, `routes.tsx`, dev flags)
* `pages/` – route components (landing, vaults list, vault detail, portfolio, apps list)
* `apps/` – “product modules” (legacy multi-app style)

Inside `apps/`, you currently have:

* `apps/lib` (≈197 files): the shared foundation (components, contexts, hooks, icons, utils, manifests)
* `apps/landing` (≈11 files): landing sections used by `pages/index.tsx`
* `apps/new-landing-1` (≈13 files): appears unused (no imports found outside that folder)
* `apps/vaults-shared` (≈9 files): vault filters/sorting/settings, used by `/vaults` and portfolio
* `apps/vaults-v3` (≈53 files): this is effectively your current Vaults list UI (even for v2 vaults)
* `apps/vaults-v2` (≈55 files): mostly legacy action-flow + solvers + old vault detail UI; only a few pieces are actually used today
* `apps/nextgen` (≈89 files): *not* a standalone app in practice; it contains your current vault detail sections (“vaults-beta”) and your current deposit/withdraw widget (“final” re-export), plus some charts utilities/hooks.

The important part: even though these folders say “v2”, “v3”, “nextgen”, the runtime product is already “one app”:

* Landing `/` (pages + apps/landing)
* Vaults list `/vaults` (pages + apps/vaults-v3 + apps/vaults-shared + some nextgen)
* Vault detail `/vaults/:chainID/:address` (pages + apps/nextgen + small v3 util)
* Portfolio `/portfolio` (pages + apps/vaults-v3 + apps/vaults-shared)

So the folder layout is out of sync with reality.

---

## 2) The core structural problem: “multi-app boundaries” exist only in names, not in code

Your “apps” are not actually isolated apps. They heavily import each other:

1. `apps/nextgen` (vault detail + widget) imports v2 ABIs/types and v3 utils:

* `pages/vaults/[chainID]/[address].tsx` uses `@nextgen/components/vaults-beta/*` and `@nextgen/components/widget`
* It also imports `fetchYBoldVault` from `@vaults-v3/utils/handleYBold`
* Nextgen vault detail UI imports helpers from `@vaults-v2/components/details/tabs/findLatestAPY` and `@vaults-v2/schemas/reportsSchema`

1. `apps/lib` imports vaults-v3 UI:

* `apps/lib/contexts/useNotifications.tsx` imports `@vaults-v3/components/notifications/NotificationsCurtain`
* `apps/lib/components/Apps.tsx` imports both v2 and v3 menu constants (multi-app remnants)

1. `apps/vaults-v3` imports `apps/nextgen`:

* `apps/vaults-v3/components/list/APYSparkline.tsx` uses `@nextgen/hooks/useVaultChartTimeseries`
* `apps/vaults-v3/components/list/VaultsV3ExpandedContent.tsx` uses `@nextgen/components/vaults-beta/*`

This means the “separation” is mostly cosmetic. In exchange, you pay real costs:

* Confusing ownership (“where does vault detail live?”)
* Cross-package imports and circular evolution
* Bad names (things labelled “v3” are used for v2 vaults)
* Harder code-splitting and bundle hygiene (because boundaries are not clean)

---

## 3) Immediate dead weight and legacy architecture that is no longer justified

These are the first things I would remove or quarantine because they exist to support the old “multiple apps” concept, not your current product.

### 3.1 `/apps` route and its support system (multi-app selector)

Evidence:

* `src/routes.tsx` includes `<Route path="/apps" element={<AppsPage />} />`
* `pages/apps/index.tsx` renders app carousels based on `apps/lib/components/Apps.tsx` datasets
* `apps/lib/hooks/useCurrentApp.tsx` maps pathnames to “apps” using `APPS` config
* `apps/lib/data/*-manifest.json` supports that app concept

If your product is now “landing + vaults + portfolio”, this “apps marketplace” is legacy. Removing it lets you delete:

* `pages/apps/*`
* `apps/lib/components/Apps.tsx`
* `apps/lib/components/CategorySection.tsx` (used only by AppsPage)
* `apps/lib/hooks/useCurrentApp.tsx` (or shrink it to “route meta” only)
* manifests that aren’t needed (at minimum `landing-manifest.json`, `nextgen-manifest.json`, and likely `vaults-beta-manifest.json`)

Strong recommendation: delete the `/apps` route entirely and remove the concept of “multiple apps” from UI/navigation and code.

### 3.2 `apps/new-landing-1` (unused)

I found no imports of `@new-landing/*` anywhere outside that directory. It appears to be a dead experiment. Move it to a branch or delete it.

### 3.3 Legacy v2/v3 “tabbed vault detail” UI (very likely dead)

These appear to have no external imports:

* `apps/vaults-v2/components/details/*`
* `apps/vaults-v3/components/details/*`

Examples:

* `VaultActionsTabsWrapper.tsx` exists in both v2 and v3, but neither is imported anywhere else.
* `VaultDetailsTabsWrapper.tsx` exists in both, but neither is imported anywhere else.

Your live vault detail page is `pages/vaults/[chainID]/[address].tsx` and it uses nextgen “vaults-beta” sections + Widget. If that’s the intended vault detail, the old “tabs wrapper” detail system should be removed rather than kept “just in case”. Keeping it guarantees future duplication and confusion.

### 3.4 Stale route/version logic

Evidence:

* `apps/lib/contexts/useNotifications.tsx` sets `isV3 = pathname.includes('/v3')` and selects variants. But your router redirects `/v3 → /vaults`, so the path will not contain `/v3` in practice. This makes the “variant” concept stale and likely always falls into one path.
* `src/routes.tsx` contains legacy redirects and a duplicated `/vaults` redirect route that is redundant/confusing next to the actual `/vaults` route group.

This isn’t just cleanup; it’s correctness and maintainability.

### 3.5 `api/vault/meta.ts` still references `/vaults-beta`

Evidence:

* `api/vault/meta.ts` uses canonical URLs like `https://yearn.fi/vaults-beta/...`

If `/vaults-beta` is not a real product route anymore, this is technical debt that will leak into SEO/social previews.

---

## 4) Consolidation targets: what should become “one Vaults feature directory”

Right now, the real Vaults product surface is split across four places:

* `pages/vaults/*` (routes)
* `apps/vaults-v3/*` (list + notifications)
* `apps/vaults-shared/*` (filters/sorts/settings)
* `apps/nextgen/*` (vault detail sections + widget + charts)
  …and it still pulls small pieces from `apps/vaults-v2/*` (schemas/helpers/abis/types)

The correct move is to consolidate this into a single “Vaults feature” module, with internal sub-areas for v2/v3 differences.

### 4.1 What to rename / re-home (high confidence)

1. `apps/vaults-v3` → becomes the canonical `apps/vaults` (or `src/features/vaults`)
   Reason: your “v3 list row” is already your unified vaults list row.

Example: `apps/vaults-v3/components/list/VaultsV3ListRow.tsx` is used to render *combined v2 + v3 vaults* in `pages/vaults/VaultsPageContent.tsx`. That name is now actively misleading. Rename it to something like:

* `VaultsListRow.tsx`
* `VaultRow.tsx`

Same for:

* `VaultsV3ListHead.tsx` → `VaultsListHead.tsx`
* `VaultsV3ExpandedContent.tsx` → `VaultsListExpandedContent.tsx`
* `VaultsV3ListEmpty.tsx` → `VaultsListEmpty.tsx`

1. `apps/vaults-shared` should be absorbed into `apps/vaults/shared` (or `apps/vaults/components/shared`)
   Reason: it’s not truly “shared across apps”; it’s shared inside the Vaults feature (vaults list + portfolio list). Keeping it as a separate top-level “app” is legacy structure.

2. `apps/nextgen/components/vaults-beta/*` should be renamed and moved under Vaults detail
   Reason: it is your actual vault detail UI. The “beta” naming leaks the wrong mental model.

Suggested move:

* `apps/nextgen/components/vaults-beta/*` → `apps/vaults/components/detail/*`

  * `VaultDetailsHeader.tsx`
  * `VaultChartsSection.tsx`
  * `VaultStrategiesSection.tsx`
  * `VaultRiskSection.tsx`
  * `VaultInfoSection.tsx`
  * `VaultAboutSection.tsx`
  * `QuickStatsGrid.tsx`
  * `NextgenVaultsListStrategy.tsx` (rename to `VaultsListStrategy.tsx` or `VaultStrategyRow.tsx`)

1. `apps/nextgen/components/widget/*` should move under Vaults as well
   Reason: the widget is only used on the vault detail page, and it depends on vault semantics (vault address, asset token, staking token, etc). Treat it as part of the Vaults feature until proven otherwise.

Suggested move:

* `apps/nextgen/components/widget/*` → `apps/vaults/components/widget/*`

1. `apps/vaults-v2/schemas/reportsSchema.ts` + `apps/vaults-v2/components/details/tabs/findLatestAPY.ts` should move to a shared “reports” util location
   Reason: they are generic helpers used by current vault detail code, but live under “v2 details tabs”.

Suggested move:

* `apps/vaults/domain/reports/` or `apps/lib/domain/reports/`

  * `reports.schema.ts`
  * `findLatestAPY.ts`

### 4.2 What to delete (high confidence)

These are “duplicated structures” that are functionally obsolete given your current routing and component usage:

* `apps/new-landing-1/*` (unused)
* `pages/apps/*` + `apps/lib/components/Apps.tsx` + `apps/lib/components/CategorySection.tsx` + manifests tied to that page
* `apps/vaults-v2/components/*` (legacy UI; except move the small helpers/schemas you still use)
* `apps/vaults-v3/components/details/*` (appears unused)
* Potentially most of `apps/vaults-v2/contexts/*` and `apps/vaults-v2/hooks/solvers/*` (see next section)

This is the kind of deletion that makes the rest of the refactor easier and safer because you are removing competing systems.

---

## 5) Concrete duplication you should eliminate

This section answers your “what utilities are duplicated / what can be consolidated” question with specific file-level evidence.

### 5.1 Duplicated solver implementations (v2 vs nextgen)

You have two different solver systems:

* Old v2 solver hooks:

  * `apps/vaults-v2/hooks/solvers/useSolverCowswap.ts`
  * `apps/vaults-v2/hooks/solvers/useSolverGaugeStakingBooster.ts`
  * plus many other v2 solvers and a large v2 “solver context” system

* Nextgen solver hooks:

  * `apps/nextgen/hooks/solvers/useSolverCowswap.ts`
  * `apps/nextgen/hooks/solvers/useSolverGaugeStakingBooster.ts`
  * `apps/nextgen/hooks/solvers/useSolverEnso.ts`

This is not “versioned”; it’s “two competing architectures”. You should pick one.

My opinion: keep the nextgen approach and delete the v2 solver system, unless you can point to a currently-used UI path that still depends on it. Right now, most v2 solver usage is tied to the legacy v2 action-flow/detail UI, which appears unused.

Minimum consolidation:

* Create `apps/vaults/widget/solvers/` (or `apps/vaults/solvers/`) and keep a single implementation per solver type.
* Move shared solver types out of `apps/vaults-v2/types/solvers.ts` into the new shared solver folder.
* Remove v2 solver context (`apps/vaults-v2/contexts/useSolver.tsx`) if nothing uses it except legacy UI.

### 5.2 Duplicated Settings popovers

Two separate “SettingsPopover.tsx” exist:

* `apps/vaults-shared/components/SettingsPopover.tsx` (Headless UI, tightly coupled to Yearn context, solver disabling logic)
* `apps/nextgen/components/widget/SettingsPopover.tsx` (Vaul/Popover from lib, widget-centric settings like slippage + auto-staking)

They represent the same user concept (zap slippage, auto-stake) but implemented twice.

Recommended resolution:

* Keep *one* settings component, and make it configurable.
* Since the “final widget” uses the nextgen widget settings (`../SettingsPopover` inside `apps/nextgen/components/widget/deposit/index.tsx`), I would make that the canonical one and delete the vaults-shared one, or re-wrap it as a thin adapter.
* Put it under the widget module (`apps/vaults/components/widget/SettingsPopover.tsx`) and reuse it wherever needed.

### 5.3 Duplicated vault migration row component

* `apps/vaults-v2/components/list/VaultsListInternalMigrationRow.tsx`
* `apps/vaults-v3/components/list/VaultsListInternalMigrationRow.tsx`

You only need one. Since the v2 list appears unused, keep the v3 one and move it into the unified vaults list folder.

### 5.4 ABIs are split across three places

You currently store ABIs in:

* `apps/lib/utils/abi/*`
* `apps/vaults-v2/utils/abi/*`
* `apps/vaults-v3/utils/abi/*`

This is exactly the kind of “version folder leakage” that makes people import random ABIs from “v2” because they happen to be there.

Recommended resolution:

* Create `apps/lib/contracts/abi/` (or `src/contracts/abi/`) and put all ABIs there.
* Make versioning explicit in filenames, not directory names:

  * `vault-v2.abi.ts`
  * `vault-v3.abi.ts`
  * `tokenized-strategy.abi.ts`
  * `erc4626-router.abi.ts`
  * etc.

Then update imports everywhere to point to the contracts module.

### 5.5 The yBOLD patching exists in more than one place

* `apps/lib/hooks/useFetchYearnVaults.ts` includes a yBOLD “staked vault” patching block
* `apps/vaults-v3/utils/handleYBold.ts` fetches and merges yBOLD vault data for detail fetch

This should be one reusable “patch vault data” function in a single place (preferably in the data layer so all pages get the same normalization).

Recommended resolution:

* Create `apps/vaults/domain/normalizeVault.ts` (or similar) and move yBOLD patch logic there.
* Apply it in both:

  * list fetch (`useFetchYearnVaults`)
  * detail fetch (`fetchYBoldVault` or whatever becomes the new “fetch vault by address” helper)

---

## 6) Architectural decisions that are no longer needed (and should be removed)

This is the “tell it like it is” section.

### 6.1 “Apps” as a top-level product abstraction

You no longer have multiple apps. Stop organizing the repo like you do.

Concrete changes:

* Remove `/apps` route
* Delete “apps catalog” components and data
* Replace `useCurrentApp` + manifests with a simpler “route metadata” system or a single global manifest

### 6.2 Versioned directories that do not match product boundaries

You currently have:

* `vaults-v2` (contains lots of stuff that has nothing to do with “v2 vaults” anymore)
* `vaults-v3` (contains the unified list, not “v3-only”)
* `nextgen` (contains the real vault detail)

These names make the codebase lie to engineers.

Replace with:

* A single `vaults/` feature area
* Inside it, explicitly version the pieces that truly differ (contract interactions, staking, semantics):

  * `vaults/adapters/v2/*`
  * `vaults/adapters/v3/*`
  * `vaults/contracts/*`
  * `vaults/types/*`

### 6.3 Two competing transaction stacks (legacy handleTx vs nextgen TxButton/actions)

There is a legacy transaction helper layer in `apps/lib/utils/wagmi/*` (e.g. `handleTx` + big `actions.ts`) and a newer “simulate + TxButton” approach in nextgen widget.

Given the legacy `actions.ts` is only imported by v2 solver hooks, the clean move is:

* Remove v2 solver system
* Delete `apps/lib/utils/wagmi/actions.ts` if nothing else uses it
* Standardize on one transaction execution pattern (the nextgen widget approach is already closer to modern wagmi/viem)

### 6.4 “Vaults beta” naming and SEO endpoints for it

If `/vaults-beta` is not a real route:

* Remove it from manifests and meta builders
* Remove references in serverless `api/vault/meta.ts`
* Rename “vaults-beta” folder to “vaults/detail”

---

## 7) Proposed target structure

You asked for “single directory consolidation”. Here is a pragmatic target layout that maps directly to your actual product:

Option A (minimal churn, keep `apps/lib` naming)

* `apps/lib/` – shared foundation (keep alias `@lib`)
* `apps/landing/` – landing feature (keep alias `@landing`)
* `apps/vaults/` – new canonical vaults feature (replace vaults-v2, vaults-v3, vaults-shared, nextgen vault pieces)

Example:

apps/
lib/
components/
contexts/
hooks/
icons/
utils/
contracts/abi/              <-- new (move all ABIs here)
data/                       <-- keep only what you still use
landing/
components/
vaults/
pages/
VaultsListPage.tsx        <-- optionally move from /pages later
VaultDetailPage.tsx
components/
list/
detail/
widget/
notifications/
shared/                   <-- filters/sorters that are “vaults shared”
hooks/
list/
detail/
widget/
charts/
domain/
adapters/
v2/
v3/
reports/
reports.schema.ts       <-- moved from vaults-v2
findLatestAPY.ts
normalizeVault.ts         <-- yBOLD etc
utils/
charts.ts                 <-- moved from nextgen/utils/charts.ts

Option B (more standard Vite/React organization)

* Move feature code into `src/features/*` and keep `apps/lib` as `src/shared/*`.

This is cleaner long-term, but it’s more churn. Option A gets you 80% of the benefit quickly.

---

## 8) A realistic migration plan (sequenced to reduce risk)

Phase 0: Baseline and guardrails (same day)

* Add a simple “dead route” check: remove `/apps` from navigation and confirm nothing breaks.
* Add a CI step that fails if `apps/new-landing-1` is imported (prevents accidental reactivation).

Phase 1: Delete/quarantine obvious dead code (1–2 days)

* Remove `apps/new-landing-1`
* Remove `pages/apps` + all dependent lib components/data used only by that page
* Remove legacy vault detail UI:

  * `apps/vaults-v2/components/details/*`
  * `apps/vaults-v3/components/details/*`
* Remove v2 list UI if unused:

  * `apps/vaults-v2/components/list/*`

Phase 2: Create `apps/vaults` and start moving “live” code (2–5 days)

* Copy/move from:

  * `apps/vaults-v3/components/list/*` → `apps/vaults/components/list/*`
  * `apps/vaults-shared/*` → `apps/vaults/components/shared/*` + `apps/vaults/hooks/*`
  * `apps/nextgen/components/vaults-beta/*` → `apps/vaults/components/detail/*`
  * `apps/nextgen/components/widget/*` → `apps/vaults/components/widget/*`
* Keep temporary re-export files in old locations so you can migrate imports gradually without massive PRs.

Phase 3: Unify the domain/utilities (2–4 days)

* Move:

  * reports schema + `findLatestAPY` out of vaults-v2
  * chart utils out of nextgen
  * yBOLD patch into one normalization function used by both list and detail fetch

Phase 4: Kill the versioned “app” aliases (optional but recommended)

* Replace `@vaults-v2`, `@vaults-v3`, `@nextgen`, `@vaults-shared` with:

  * `@vaults/*` (single feature alias)
* Remove the toxic alias:

  * `@utils/*` currently points specifically to `apps/nextgen/utils/*` (this is a footgun; `@utils` should never mean “some specific feature’s utils”)

Phase 5: Cleanup routing and metadata

* Simplify `src/routes.tsx` (remove redundant `/vaults` redirect route, keep only needed legacy redirects)
* Replace `useCurrentApp` with a tiny `useRouteMeta()` or a static config for meta tags
* Fix `api/vault/meta.ts` canonical routes (remove `/vaults-beta`)

---

## 9) What you gain (why this is worth doing)

* Engineers stop wasting time figuring out whether “nextgen” is a separate app or the real vault page.
* Vaults/Portfolio become a coherent “data-heavy feature area” with clear ownership.
* You can do proper code-splitting by feature because boundaries are real, not fake.
* You eliminate duplicated systems (solvers, settings, action flows) that otherwise rot and diverge.
* You reduce the chance of shipping dead code and dead dependencies, which directly impacts cold start and hard refresh time.
