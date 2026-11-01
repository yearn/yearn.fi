# ERC-4626 utility

A small Next.js app for opening synchronous ERC-4626 vaults and indexed Yearn factory vaults, depositing their underlying ERC-20 assets and withdrawing back to those assets. It consumes `@yearn/vault-widget`; it does not maintain a separate transaction implementation.

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

Supported networks: Ethereum, Base, Arbitrum, Optimism, Polygon and Robinhood Chain (4663). Configure `NEXT_PUBLIC_RPC_ROBINHOOD` to override the Robinhood public RPC. Links can select a vault with `/?chain=1&vault=0x…`. Unsupported chain IDs are rejected rather than silently mapped to Ethereum.

Direct ERC-4626 transactions require no price service or Yearn metadata. Token inputs, capacity and positions are displayed in underlying-asset units. A share token’s decimals can differ from its asset’s decimals. This host enables deposit zaps from funded supported networks and withdrawals to tokens across supported networks; staking remains disabled.

## Wallet-free UX playground

`/demo/segmented` is a separate styling comparison using the same wallet and widget flows. Its Deposit/Withdraw, vault source and Single Asset/LP Token selectors use the main vault list's connected segments, with shared borders and a white active segment. The action switch, chart and settings buttons sit inside the card; full-card overlays cover them. `/demo` retains its header above the card and its existing selector styling.

Open `/demo` to use the actual `VaultApp`, `VaultPicker` and `Erc4626VaultWidget` with an automatically connected simulated wallet. The same Kong catalog supplies Yearn vaults; network filters, retired-vault controls, direct addresses, metadata and quotes use the live app's data paths. The In my wallet filter reads the current simulated yvUSD and factory share balances rather than querying a real wallet indexer. Demo controls float at the bottom right and start collapsed.

The isolated demo provider starts with unlocked yvUSD worth about 1,000 USDC, 25 steCRV LP tokens a Curve stETH factory position worth 10 steCRV and 1,000 USDC on Base. Other token and native balances start at zero. Withdraw yvUSD to obtain sample USDC; steCRV can be deposited directly into its factory vault. Allowances, withdrawal limits and receipts are simulated; live previews or factory PPS determine balance changes. Approval, deposit, withdrawal and failure screens are the production widget's UI. Reset demo clears the simulated wallet, allowances and query cache. The demo RPC layer only forwards read-only methods, and both the execution adapter and connector keep transactions local. Live data failures remain visible. The live widget remains available at `/`.

## Ownership

- `apps/4626`: selection page, wallet/Query providers, RPC configuration, notifications, Safe status integration, deployment.
- `packages/vault-widget`: generic vault reader, explicit contract kind, quote/limit handling, inputs, approval/deposit/withdrawal flows and transaction presentation.
- `apps/yearn` and `apps/ybold`: existing consumers; their legacy data paths remain supported.

The generic reader pins each snapshot to one block. Failed critical reads block actions instead of substituting zero balances or guessed decimals. `convertToAssets` supplies accounting value; operation previews and limits supply transaction amounts. MAX redeems the contract-permitted shares when its proceeds match the withdrawal limit, otherwise it withdraws the exact permitted asset amount.

Direct ERC-4626 calls do not enforce a custom minimum-output slippage bound. Preview amounts can change before mining. Async request/claim vaults and custom Yearn max-loss overrides remain outside this preset.

## Chart sidecar

The chart button opens a responsive sidecar for the selected vault in both demo versions and the live host. It loads Kong history only while open, with Share value (humanized PPS, in underlying-asset units), trailing 30-day net APY and USD TVL views. The 1W, 1M, 1Y and All controls filter real observations; pointer/touch inspection and keyboard arrows/Home/End expose individual dates and values. No history, request failures and missing observations stay distinct, and missing points or long gaps break the line. Closing restores focus to the chart button. The shared widget accepts a host-owned `renderChart` slot rather than depending on Kong.

## Asset zaps

The shared widget's token selector and Enso deposit/withdraw flows are enabled by this host. Click the amount's token button to deposit another wallet asset, or choose an output asset when withdrawing. Direct underlying-token operations keep using the existing direct path. Transaction settings supply zap slippage; retired-vault deposit confirmation also applies to zaps.

`VaultZapRuntime` loads the same Yearn token lists as the main app and reads wallet balances across supported networks on demand. Withdrawals offer all six supported chains and the main widget's curated popular tokens, including tokens with zero wallet balance. Missing popular-token metadata is read on-chain. Deposits offer the vault's chain plus supported source networks where the wallet holds assets; approvals and execution run on the selected asset's chain. The demo includes 1,000 Base USDC for this flow. Quotes use `https://yearn.fi/api/enso/route`; unsupported routes show failures rather than fabricated quotes. The shared widget keeps Enso router validation, approval handling, quote refresh and execution simulation.

In the demo, live quote responses register the exact calldata and input/output amounts with the isolated wallet. Only quotes for supported destination networks, the demo account and known source-chain Enso routers can settle; approval, balance and quote-expiry checks still apply. Successful simulated receipts debit the input on the source chain and immediately credit the quoted output on its destination chain; this does not simulate bridge waiting times. Failed receipts preserve balances. Raw signing and broadcast methods remain rejected. Reset clears registered routes as well as balances.

Recent transactions are tracked for the active page session, including when the user changes the selected vault. Safe proposals are not treated as completed withdrawals/deposits until an execution receipt is available. Reload recovery and persistent transaction history are not implemented here.

## Deployment

Configure the project root as `apps/4626`. `vercel.json` disables automatic GitHub deployment; no production/domain cutover is performed by adding this app. Keep the old `yearn/vaults-app` deployment until acceptance checks and an explicit cutover.

The app uses `@yearn/site-header`, the same masthead and navigation consumed by `apps/yearn`, with Yearn links resolved against `https://yearn.fi`. Its wallet controls remain connected to this app's providers. Theme preferences and tokens are shared with the main app; the mobile menu exposes navigation, theme and wallet access.

Connected wallets open the shared Yearn account dropdown (or the same account content in the mobile menu), with address copying, disconnect, theme settings, network switching and this session's activity for the connected account. No USD portfolio total is shown. RainbowKit still provides the initial wallet connection and network-selection dialogs.

## Vault selection

The widget is always visible, with a Select vault control above Deposit/Withdraw. No transaction form is activated until a vault has been read successfully. Selecting a different vault clears its amount inputs while preserving the chosen action. Existing chain/address deep links still work.

The picker has two lists and an address search:

- **Yearn Vaults** (default): Kong's Yearn catalog with Single Asset / LP Token controls. More filters includes retired vaults, single asset strategies, legacy vaults, asset category and In my wallet. Indexed Yearn factory vaults use the shared V2 deposit/withdraw paths: `token`, `pricePerShare`, `availableDepositLimit`, and `withdraw(shares, recipient)`. Emergency shutdown blocks deposits. Factory withdrawal values are estimates; simulation checks whether the requested withdrawal can execute. Other legacy contracts remain unavailable here.
- **All Vaults**: Kong's unfiltered `/api/rest/list/vaults` catalog, retaining external vaults even when origin is unknown. Hidden entries, unsupported chains, missing assets and known legacy contracts are excluded. ERC-4626 candidates are checked on-chain before selection; indexing alone does not prove synchronous ERC-4626 compatibility. Search covers the full catalog; Load more limits the rendered rows.
- **In my wallet** filter: the existing `https://yearn.fi/api/enso/balances` endpoint supplies token candidates across supported chains. RPC reads check `asset`, `convertToAssets` and the connected account's current share balance; USD prices are ignored. Discovery checks at most 500 candidates, eight at a time. Indexer omissions are possible; failed checks and scan limits are shown, and direct address entry remains available. Holdings queries are invalidated after transaction receipts.
- **Paste address**: choose the contract's network and validate it directly. This path works independently of either discovery service.

The selector and form share one card below the action header. With no selection, the form is disabled and values remain unavailable. The host supplies a dropdown through the widget's `vaultSelector` slot; it fills that card, keeps focus within the picker and closes on Escape or an outside click. The chain selector sits above the search without a divider.

Rows show the vault name and a chain badge on the token logo. Matching wallet positions sort first, then vaults sort by descending Kong TVL within each group. Unknown TVL sorts after known values, including genuine zero; it is never presented as zero. Wallet discovery runs when the picker opens, independently of the In my wallet filter.

Deposit mode shows positive underlying-token balances at the right of matching rows. Withdraw mode shows share balances and USD values from the shared Yearn spot-price feed; missing prices display as unavailable. Balance reads are batched for visible rows, use the isolated transport in the demo, and refresh after transactions. Details and action buttons sit at the bottom of the card, with flexible space below the amount input.

Discovery is an app-owned convenience, not an exhaustive ERC-4626 registry. The shared widget accepts an optional address and a host-owned selection callback; it has no dependency on the wallet indexer or Kong. A catalog or discovery failure does not disable an already selected vault's RPC-backed transactions.

Known retired Yearn V3 and factory vaults open on Withdraw. Clicking Deposit opens a disclaimer; a checked risk acknowledgment and Continue to deposit are both required before the deposit form appears. Cancel/Escape leaves Withdraw active. Acceptance is local to the current vault and wallet, and switching back from Withdraw to Deposit asks again. Wallet/address selections and deep links are matched against Yearn catalog metadata, including hidden factories. Initial reads wait for the catalog lookup to determine the correct contract interface. Retirement cannot be identified for an uncatalogued vault or if catalog lookup fails; uncatalogued addresses use only the ERC-4626 path.

Wallet-list visibility follows yearn.fi: explicitly hidden Yearn vault addresses and their staking-token aliases are excluded per chain, using the same Kong catalog fetched for the Yearn tab. Retired and uncatalogued external vaults remain eligible. The first catalog lookup finishes before wallet rows appear. If visibility metadata is unavailable, cached exclusions are retained when available and a retry notice is shown; unknown vaults are not treated as hidden. Filtering affects the picker list, not raw wallet balances or direct address entry.
