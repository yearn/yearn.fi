# ERC-4626 utility

A small Next.js app for opening a synchronous ERC-4626 vault by network and address, depositing its underlying ERC-20 asset and withdrawing back to that asset. It consumes `@yearn/vault-widget`; it does not maintain a separate transaction implementation.

## Run

From the repository root:

```sh
bun install --frozen-lockfile
bun run dev:4626         # localhost:3004
bun run build:4626
bun run preview:4626     # localhost:3004
bun run tslint:4626
bun run test:4626
```

If Turbopack cannot create its worker sockets in a restricted environment, use `bun run --cwd apps/4626 build --webpack` for the production build.

Copy `.env.example` to `.env.local` for optional RPC overrides and a WalletConnect project ID. Injected wallets and Safe remain available without a WalletConnect ID. Production should configure suitable RPC providers for each network.

Supported networks: Ethereum, Base, Arbitrum, Optimism and Polygon. Links can select a vault with `/?chain=1&vault=0x…`. Unsupported chain IDs are rejected rather than silently mapped to Ethereum.

Direct address entry and transactions require no price service, Kong catalog or Yearn vault metadata. Token inputs, capacity and positions are displayed in underlying-asset units. A share token’s decimals can differ from its asset’s decimals. The preset disables staking, swaps and cross-chain zaps.

## Ownership

- `apps/4626`: selection page, wallet/Query providers, RPC configuration, notifications, Safe status integration, deployment.
- `packages/vault-widget`: generic vault reader, explicit contract kind, quote/limit handling, inputs, approval/deposit/withdrawal flows and transaction presentation.
- `apps/yearn` and `apps/ybold`: existing consumers; their legacy data paths remain supported.

The generic reader pins each snapshot to one block. Failed critical reads block actions instead of substituting zero balances or guessed decimals. `convertToAssets` supplies accounting value; operation previews and limits supply transaction amounts. MAX redeems the contract-permitted shares when its proceeds match the withdrawal limit, otherwise it withdraws the exact permitted asset amount.

Direct ERC-4626 calls do not enforce a custom minimum-output slippage bound. Preview amounts can change before mining. Async request/claim vaults and custom Yearn max-loss overrides are outside this direct-only preset.

Recent transactions are tracked for the active page session, including when the user changes the selected vault. Safe proposals are not treated as completed withdrawals/deposits until an execution receipt is available. Reload recovery and persistent transaction history are not implemented here.

## Deployment

Configure the project root as `apps/4626`. `vercel.json` disables automatic GitHub deployment; no production/domain cutover is performed by adding this app. Keep the old `yearn/vaults-app` deployment until acceptance checks and an explicit cutover.

The app uses `@yearn/site-header`, the same masthead and navigation consumed by `apps/yearn`, with Yearn links resolved against `https://yearn.fi`. Its wallet controls remain connected to this app's providers. Theme preferences and tokens are shared with the main app; the mobile menu exposes navigation, theme and wallet access.

Connected wallets open the shared Yearn account dropdown (or the same account content in the mobile menu), with address copying, disconnect, theme settings, network switching and this session's activity for the connected account. No USD portfolio total is shown. RainbowKit still provides the initial wallet connection and network-selection dialogs.

## Vault selection

The widget is always visible, with a Select vault control above Deposit/Withdraw. No transaction form is activated until a vault has been read successfully. Selecting a different vault clears its amount inputs while preserving the chosen action. Existing chain/address deep links still work.

The picker has two lists and an address search:

- **In your wallet**: the existing `https://yearn.fi/api/enso/balances` endpoint supplies token candidates across supported chains. RPC reads check `asset`, `convertToAssets` and the connected account's current share balance; USD prices are ignored. Discovery checks at most 500 candidates, eight at a time. Indexer omissions are possible; failed checks and scan limits are shown, and direct address entry remains available. Holdings queries are invalidated after transaction receipts.
- **Yearn vaults**: Kong's public Yearn catalog supplies visible V3 Multi Strategy allocator vaults on supported chains. Retired vaults are available through a checkbox. Every selection is validated by the generic on-chain reader, including account limits, before it replaces the current vault.
- **Paste address**: choose the contract's network and validate it directly. This path works independently of either discovery service.

Discovery is an app-owned convenience, not an exhaustive ERC-4626 registry. The shared widget accepts an optional address and a host-owned selection callback; it has no dependency on the wallet indexer or Kong. A catalog or discovery failure does not disable an already selected vault's RPC-backed transactions.

Known retired Yearn allocator vaults open on Withdraw. Clicking Deposit opens a disclaimer; a checked risk acknowledgment and Continue to deposit are both required before the deposit form appears. Cancel/Escape leaves Withdraw active. Acceptance is local to the current vault and wallet, and switching back from Withdraw to Deposit asks again. Wallet/address selections and deep links are matched against the Yearn allocator catalog as well as metadata carried by a selected Yearn row. Withdrawals remain available while the initial catalog lookup runs; deposits wait for that lookup. Retirement cannot be identified for an uncatalogued vault or if catalog lookup fails, and direct RPC interaction remains available in those cases.
