# TODO

Format:

- Tables with columns: Issue | Status | Date | Summary | Location | Spec | Group | Root Branch | Work Branch

## Inbox

| Issue | Status | Date | Summary | Location | Spec | Group | Root Branch | Work Branch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

## Bugs

| Issue | Status | Date | Summary | Location | Spec | Group | Root Branch | Work Branch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GH-867 | spec'd |  | Blended 30-day APY misrepresents Katana vaults; decide Katana 30D handling and add explanatory asterisk. | /portfolio | docs/specs/portfolio-katana-30d-apy.md | portfolio-apy | Feat--New-Vault-Page | portfolio/apy |
| GH-869 | spec'd |  | Horizon USDC yVault on Base shows 0% APY for strategies; fix strategy list APY sourcing and missing-data handling. | /vaults/ {chainID}/ {address} | docs/specs/base-horizon-strategy-apy-zero.md | vaults-apy-data | Feat--New-Vault-Page | vaults/apy-data |
|  |  |  |  |  |  |  |  |  |

## UX

| Issue | Status | Date | Summary | Location | Spec | Group | Root Branch | Work Branch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GH-868 | In Progress |  | Allocator vault list shows unexpected secondary tooltip value on hover; remove conflicting tooltip. | /vaults (allocator list) | docs/specs/allocator-vaults-tooltip-conflict.md | vaults-tooltips | Feat--New-Vault-Page | vaults/tooltips |
| GH-870 | In Progress |  | Chain selector label on factory vaults shows "All" instead of "All Chains". | /vaults (factory) | docs/specs/vaults-factory-chain-selector-label.md | vaults-filters | Feat--New-Vault-Page | vaults/filters-ui |
| GH-871 | spec'd |  | Standardize tooltip format for `/vaults` filters bar (Allocator/Factory/Ethereum). | /vaults filters | docs/specs/vaults-filters-tooltip-standard.md | vaults-filters | Feat--New-Vault-Page | vaults/filters-ui |
| GH-872 | In Progress |  | Trending vaults card disappears when no vaults are fetched; add size-matched skeleton to avoid layout shift. | /vaults (trending) | docs/specs/trending-vaults-skeleton.md | vaults-list-ui | Feat--New-Vault-Page | vaults/list-ui |
| GH-873 | In Progress |  | Factory vault list: remove boost subline under Est. APY, show rocket hover popover with boost amount; no modal on Est. APY. | /vaults (factory list) | docs/specs/factory-vaults-boost-popover.md | vaults-list-ui | Feat--New-Vault-Page | vaults/list-ui |
| GH-874 | In Progress |  | Vaults list chips: add click-to-filter, active state + icons, allocator chip gated by advanced settings, reusable chip component. | /vaults list | docs/specs/vaults-list-chip-enhancements.md | vaults-list-ui | Feat--New-Vault-Page | vaults/list-ui |
| GH-875 | In Progress |  | Add fixed-term (Spectra/Pendle) icons next to Est. APY with tooltip + market link. | /vaults list + APY display | docs/specs/vaults-fixed-term-icons.md | vaults-list-ui | Feat--New-Vault-Page | vaults/list-ui |
| GH-883 | spec'd | 2026-01-05 | Prefetch factory vaults to eliminate toggle delay. | /vaults filters toggle | docs/specs/vaults-factory-prefetch.md | vaults-filters | Feat--New-Vault-Page | vaults/filters-ui |
| GH-884 | spec'd | 2026-01-05 | Remove full Dark theme; keep Soft-Dark only. | Dev toolbar / theme selector | docs/specs/remove-full-dark-mode.md | theme-ui | Feat--New-Vault-Page | theme/soft-dark-only |
|  |  |  |  |  |  |  |  |  |

## Tech Debt

| Issue | Status | Date | Summary | Location | Spec | Group | Root Branch | Work Branch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

## Docs

| Issue | Status | Date | Summary | Location | Spec | Group | Root Branch | Work Branch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |
