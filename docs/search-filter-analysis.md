# Search & Filter Analysis for Vaults v3

## Current Flow Overview
- **Search input**: `apps/lib/components/SearchBar.tsx` keeps a local value and a 1000 ms debounce before calling `onSearch`, slowing UI feedback.
- **Query management**: `apps/vaults-v2/hooks/useVaultsQueryArgs.ts` mirrors filters in the URL via underscore-separated lists (`types`, `categories`, `chains`) and resets via `onReset`/`onResetMultiSelect`.
- **Filtering**: `apps/lib/hooks/useFilteredVaults.ts` applies chain, category, holdings, type, and regex search filters per vault; holdings skip the search clause entirely.
- **List rendering**: `pages/v3/index.tsx` recomputes `useVaultFilter` three extra times to derive “potential” matches and holdings, then rebuilds sorted arrays each render.

## Issues & Opportunities
- Long debounce and repeated URL writes make search feel sluggish.
- Holdings bypass the search regex, so non-matching vaults still show in that card.
- Re-running `useVaultFilter` for multiple views causes redundant work per keystroke.
- Category strings are hard-coded (“Your Holdings”), increasing typo risk.
- Hidden-results messaging lacks insight into which filters blocked matches.
- Multi-select “Select All” toggles override partial selections unexpectedly.

## Quick Improvements
1. Lower search debounce to ~300–400 ms and trigger immediate updates on user pause.
2. Apply the search regex to holdings when holdings aren’t explicitly selected.
3. Memoise primary `useVaultFilter` output in `ListOfVaults` and derive other views locally.
4. Replace raw category strings with shared enums/constants.

## Chip-Based Search Proposal
- Tokenise search text into structured filters (e.g., `chain:base`, `category:stable`) using a synonym map.
- Store chips in `useQueryArguments`, serialise to a `filters` query arg, and expose add/update/remove actions.
- Render chips beneath the search bar; chips open the relevant `MultiSelectDropdown` or can be dismissed.
- Auto-map keywords (“chain”, “base”, “arbitrum”) to existing filter controls and remove those words from the free-text term.
- Retain unmatched terms as a free-text chip feeding the regex search.
- Seed defaults (Chains, Categories, Types) so users see available facets immediately.

## Implementation Notes
- Add a `parseSearchTokens` utility plus a dictionary of known chains/categories/types.
- Extend `useQueryArguments` with chip-aware state while maintaining compatibility with existing props.
- Update `Filters` to manage chip rendering and interactions alongside current dropdowns.
- Allow `useVaultFilter` to accept richer predicates from chips (e.g., APR > value) for future numeric filtering.
- Consider a shared reducer/store for chip state to keep desktop/mobile drawers in sync.
