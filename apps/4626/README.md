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

No price service, Kong catalog or Yearn vault metadata is required. Token inputs, capacity and positions are displayed in underlying-asset units. A share token’s decimals can differ from its asset’s decimals. The preset disables staking, swaps and cross-chain zaps.

## Ownership

- `apps/4626`: selection page, wallet/Query providers, RPC configuration, notifications, Safe status integration, deployment.
- `packages/vault-widget`: generic vault reader, explicit contract kind, quote/limit handling, inputs, approval/deposit/withdrawal flows and transaction presentation.
- `apps/yearn` and `apps/ybold`: existing consumers; their legacy data paths remain supported.

The generic reader pins each snapshot to one block. Failed critical reads block actions instead of substituting zero balances or guessed decimals. `convertToAssets` supplies accounting value; operation previews and limits supply transaction amounts. MAX redeems the contract-permitted shares when its proceeds match the withdrawal limit, otherwise it withdraws the exact permitted asset amount.

Direct ERC-4626 calls do not enforce a custom minimum-output slippage bound. Preview amounts can change before mining. Async request/claim vaults and custom Yearn max-loss overrides are outside this direct-only preset.

Recent transactions are tracked for the active page session, including when the user changes the selected vault. Safe proposals are not treated as completed withdrawals/deposits until an execution receipt is available. Reload recovery and persistent transaction history are not implemented here.

## Deployment

Configure the project root as `apps/4626`. `vercel.json` disables automatic GitHub deployment; no production/domain cutover is performed by adding this app. Keep the old `yearn/vaults-app` deployment until acceptance checks and an explicit cutover.
