# Vault widget parity gate

The package must not replace the complete yearn.fi widget surface or be
published as the production dependency until every row below is complete.

| Area | Status | Evidence |
| --- | --- | --- |
| Direct ERC-4626 deposit/withdraw | Complete | `headless/adapters.ts`, package tests |
| Direct Yearn V2 deposit/withdraw | Complete | V2 price-per-share adapter, Kong snapshot resolver, package tests, parity fixture |
| yBOLD direct zap in/out | Complete | `presets/yBold.ts`, yearn-bold build |
| Enso same-chain yBOLD routes | Complete | trusted-route validation and package tests |
| Allowance reset and approval planning | Complete | `transactionPlan.test.ts` |
| Legacy yearn.fi settings and activity storage | Complete | `storage.test.ts` |
| Package artifact isolation | Complete | npm pack dry run and import scan |
| Stake, unstake, and combined routes | Complete | Kong staking metadata, selectable vault/staked positions, source-aware adapters, composed valuation, and ordered plans |
| Generic same-chain and cross-chain Enso | Complete | Trusted route validation, protected re-quotes, bridge protocol discovery, submitted state, and destination completion polling |
| Safe proposal and delayed execution | In progress | Atomic plan batching, connector detection, proposal submission, and execution polling complete; live Safe QA pending |
| yvUSD locked/unlocked and cooldown | Pending | Product preset and controller required |
| yvBTC locked/unlocked | Pending | Product preset and controller required |
| Permit and approval migration | Pending | Migration controller and UI required |
| Merkle and staking rewards | Pending | Reward services, plans, and UI required |
| Full styled My Info/settings/activity parity | Pending | Component parity and accessibility suite required |
| Tenderly transaction-family QA | Pending | Requires full route matrix and funded VNet |

Current rollout state:

- yearn.fi can mount the package for the complete yBOLD surface with
  `NEXT_PUBLIC_VAULT_WIDGET_ENABLED=true`. `/dev/vault-widget` remains the
  development-only side-by-side harness, with package fixtures for yBOLD and
  direct Yearn V2 vaults, and a V3 vault with staking. Other product families
  stay on their legacy implementations until their parity gates pass.
- yearn-bold keeps its legacy card by default. Setting
  `NEXT_PUBLIC_VAULT_WIDGET_ENABLED=true` switches its entire card to the
  package for parity testing.
- The npm publish workflow requires the protected `npm` environment and an
  authorized `NPM_TOKEN`; package ownership has not been verified locally.
