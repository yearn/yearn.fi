# Chip-Based Search Exploration

## Context
- Branch: `feature/chip-search-prototype`
- Goal: Prototype UX for turning search terms into removable chips beneath the vaults v3 search bar while keeping styling changes lightweight.
- Scope so far: "dumb" UI components that manage chip state locally and reuse existing filtering logic.

## Prototype Behaviour (current)
- Pressing Enter in the vaults v3 search field creates a chip with the submitted term and clears the input.
- Chips render directly under the search input with hover-to-reveal dismiss buttons (`apps/lib/components/SearchChip.tsx`).
- Removing a chip updates the underlying search string; clearing all chips empties the search state.
- Search filtering now treats the search string as a collection of terms joined with OR semantics (match any token) so stacking chips expands results.
- Chip state syncs with the URL/query arguments: reloading or navigating preserves chips.

### Key Implementation Touchpoints
- `apps/lib/components/SearchBar.tsx`
  - Added `onSubmit` and `shouldClearOnSubmit` props so Enter emits a token, clears local state, and avoids double debounce calls.
  - Guards debounced `onSearch` to prevent stale empty updates when chips are created.
- `apps/lib/components/SearchChip.tsx`
  - Presentational component handling hover reveal of the close icon.
- `apps/vaults-v3/components/Filters.tsx`
  - Maintains chip state, renders chips under the search field, and updates the search query whenever chips are added/removed.
  - Syncs chips with incoming `searchValue` for reload/back-button support.
- `apps/lib/hooks/useFilteredVaults.ts`
  - Splits the search string into tokens and matches vaults when **any** token is present within a vault’s text fields. (Holdings still bypass search so the card can remain visible.)

### Known Limitations / Next Steps
- Chips currently duplicate tokens per whitespace; there is no UI for multi-word phrases or quoted terms.
- Holdings bypass search filtering; need a decision on whether chips should hide holdings if they do not match.
- No persistence beyond URL (i.e., no saved chip sets or facet awareness yet).
- Multi-select filters and chips operate independently; chained logic for facets (e.g., mapping `chain:base`) is not wired.

## Design Exploration: Making Chips Intuitive
Below are options discussed for extending chip behaviour:

- **Grouped OR Chips, Global AND**: Each chip contains one or more terms that OR together, while multiple chips must all match (AND). Chips support drag/drop and inline “Add keyword” controls.
- **Field-Scoped Chips**: Chips bind to specific facets (`Chain`, `Token`, `Protocol`). Multiple values within a chip can toggle between “Any” vs “All”. Free-text remains as a general chip.
- **Chip-Level AND/OR Toggle**: Provide a small toggle per chip to switch between “match any” and “match all” terms. Optional global switch to flip how chips interact with each other.
- **Modifier Syntax Chips**: Parse inline modifiers (`token:usdc`, `chain:base`, `&`, `|`) into structured chips without extra UI affordances.
- **Saved Chip Collections**: Allow chip configurations to be stored and toggled (e.g., “Stablecoins on Base”), giving users reusable filter sets.
- **Apply-to-All Filters**: Introduce a separate global filter row (e.g., `Protocol: Aave`) that applies across all chips, solving the “add Aave to every chip” scenario.
- **Advanced Builder Panel**: Expand the chip area into a rule builder with field/operator/value rows. Chips mirror the builder output, offering precise logic at the cost of heavier UI.

### Recommendation Snapshot
- Default to grouped OR chips with AND combination (current behaviour is a first step, though presently the OR applies at the token level). 
- Add an “Apply to all” filter slot for common narrowing (e.g., one protocol or chain across every chip).
- Consider introducing facet-aware chips (via modifier syntax or quick dropdown) to avoid overloading free text, especially when mapping natural language terms like “chain” or “arbitrum”.

## Todo Ideas
- Decide on holdings filtering with chips (include/exclude logic).
- Investigate multi-word/phrase handling (quoted strings or UI chips accepting spaces).
- Add UI cues for users when chips are expanding vs. narrowing results (e.g., badge copy or tooltip).
- Connect chips to actual filter facets once the UX pattern is approved.
