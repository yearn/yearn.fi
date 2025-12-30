# Vaults Toggle in Filters Bar Design

## Context
The /vaults page currently renders a V3/Factory toggle in the global header. The request is to move this toggle into the filters bar alongside the chain selector and filters button, visually matching the chain selector styling. Behavior should remain identical (URL-driven vault type selection).

## Goals
- Move the V3/Factory toggle from the header into the filters bar on /vaults.
- Render the toggle at the left side of the filters bar for both v3 and v2 filter layouts.
- Match the chain selector visual style and sizing.
- Preserve existing routing/query behavior for vault type selection.

## Non-Goals
- Changing vault filtering, sorting, or data fetching behavior.
- Redesigning the filters or chain selector components beyond a minimal layout update.
- Altering other pages or headers not related to /vaults.

## Proposed Approach
- Add a left-slot prop (e.g., `leadingControls?: ReactNode`) to `apps/vaults-v3/components/Filters.tsx` and `apps/vaults-v2/components/FiltersV2.tsx`.
- Render `leadingControls` before the chain selector group in both desktop and mobile layouts so it appears at the left side of the filters bar.
- Create a small `VaultVersionToggle` component in `pages/vaults/index.tsx` (or a nearby shared file if needed) that:
  - Reads `location.search` to determine active state.
  - Navigates to `/vaults` for V3 and `/vaults?type=factory` for Factory.
  - Uses the same height, border, and background styling as the chain selector control group.
- Remove the header toggle from `apps/lib/components/Header.tsx` so the toggle appears only within the filters bar on /vaults.

## UI/UX Details
- The toggle should share the chain selector group style: height 10, rounded corners, border, surface background, and pressed state shading.
- The toggle lives at the far left of the filter bar row, followed by the chain selector group, then the filters button and search bar.
- For mobile, the toggle should appear in the same top controls cluster as the chain selector, maintaining touch target sizing.

## Data Flow
- The toggle only updates the URL query string and does not change filtering logic.
- `pages/vaults/index.tsx` continues to derive `vaultType` from the query param to drive all list behaviors.

## Testing
- Manual QA on /vaults for both v3 and factory modes.
- Optional UI smoke test to ensure the toggle is no longer in the header and appears inside the filters bar.

## Risks
- Layout regressions in the filters bar if flex wrapping is not adjusted for the new leading control.
