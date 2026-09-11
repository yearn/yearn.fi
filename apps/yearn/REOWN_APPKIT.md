# Reown AppKit integration

Yearn uses Reown AppKit for wallet discovery, WalletConnect pairing, and session reconnect while Wagmi and Viem
remain the account and transaction substrate. The connection surface is intentionally small and immediate:
installed EIP-6963 wallets are rendered locally, and AppKit is opened only for WalletConnect or the curated
wallet catalog.

The vault widget is not forked for this integration. Yearn continues to provide the adapter-owned Wagmi config
to `@yearn/vault-widget`, including chain resolution, Safe detection, notifications, balances, and execution.

## Architecture and ownership

The wallet-enabled route tree is composed in this order:

```text
WagmiProvider (runtime-specific config, reconnectOnMount=false)
  QueryClientProvider
    ChainsProvider
      YearnWalletUiProvider
        top-level: WalletDrawerProvider + AppKit
        Safe/Ledger: no-op drawer context, no AppKit instance
        IframeAutoConnect
          Web3ContextApp
            Yearn data and wallet contexts
              YearnVaultWidgetRuntimeProvider
                Yearn header, account UI, and vault widget
```

Responsibilities are deliberately separated:

- The AppKit `WagmiAdapter` owns the top-level Wagmi config used by the application and vault widget. Safe and
  Ledger embeds use minimal Wagmi configs containing only their intended connector.
- AppKit owns top-level EIP-6963 discovery, WalletConnect pairing, supported-wallet catalog data, and reconnect.
  It is deliberately not initialized in an embed, so loading an embed cannot restore or terminate the main
  Yearn tab's WalletConnect session.
- `@yearn/wallet-ui` owns the shared adaptive connection picker, connector filtering, connection error copy,
  AppKit modal overrides, and picker motion. Both Yearn and yBOLD consume this package.
- Yearn owns its connected-account presentation. The existing header trigger, portfolio value, recent activity,
  settings, notifications, ENS/Clusters identity, and disconnect behavior remain app-specific.
- `Web3ContextApp` remains the application abstraction for opening the wallet picker and reading connected
  identity. Callers, including the vault widget and mobile navigation, do not open AppKit directly.

The shared picker exposes `WalletDrawerProvider` and `useWalletDrawer`. The provider can receive a stable dialog
ID, extra connector IDs, the current light/dark AppKit theme, app-specific positioning, and theme classes. The
connected-account menu is intentionally outside this package because its data and navigation differ between
Yearn and yBOLD.

The picker is kept because AppKit 1.8.23's native modal waits for remote catalog/assets before opening and applies
the catalog allowlist to installed wallets too. Replacing it outright would lose immediate opening and hide
detected wallets such as Rabby. One pending action handles browser-wallet connections and modal handoff; Wagmi's
connected account takes precedence over loading state. The search/certification override only observes AppKit's
modal, not the rest of the page. There is no second connector registry or reconnect owner in the picker.

The header follows yBOLD: it shows Connect wallet or the connected identity, without a connection-loading lock.
Page/widget loading follows only the shared picker's active action. After handing off to the QR/catalog modal,
Reown owns its loading UI; a transport still waiting after modal close must not keep the page busy. Embedded
Safe/Ledger handshakes retain their host-connector loading state because they do not use a connection modal.

## Compatibility matrix

The wallet stack is pinned and tested as one unit:

| Dependency | Version | Purpose |
| --- | --- | --- |
| `@reown/appkit` | `1.8.23` | Wallet catalog, WalletConnect UI, and reconnect orchestration |
| `@reown/appkit-adapter-wagmi` | `1.8.23` | Creates and synchronizes the Wagmi config used by AppKit |
| `wagmi` | `2.19.5` | React hooks and connector runtime |
| `@wagmi/core` | `2.22.1` | Core connector and execution actions |
| `viem` | `2.55.11` | Chains, transports, encoding, and RPC primitives |

AppKit and its Wagmi adapter must remain on the same version. The adapter requires Wagmi `>=2.19.5` and
`@wagmi/core >=2.21.2`. All workspace consumers resolve Wagmi `2.19.5` so React hooks, the shared picker, and the
linked vault widget use one module-local context. Any wallet-stack upgrade must be verified across Yearn,
yBOLD, `@yearn/wallet-ui`, and `@yearn/vault-widget` together.

AppKit is materially larger than a normal connector dependency. It replaces RainbowKit in Yearn; do not ship
both connection UIs or both reconnect owners.

## Networks, RPCs, and Tenderly

Yearn supports Ethereum, Optimism, Polygon, Fantom, Base, Arbitrum, Sonic, and Katana. The adapter receives the
same chain set and transports that the application previously supplied to Wagmi:

- Canonical chains remain the IDs used by routes, portfolio data, vault metadata, and the widget API.
- When Tenderly mode is disabled, wallet and canonical chain IDs are identical.
- When Tenderly mode is enabled, each configured canonical chain maps to a Tenderly execution chain. Both the
  canonical definitions and distinct execution definitions are registered with Wagmi so reads retain canonical
  meaning while wallet/RPC boundaries use the execution ID.
- Existing `NEXT_PUBLIC_RPC_URI_FOR_<chainId>` and Tenderly RPC settings remain the source of application
  transports. AppKit must not introduce a second, conflicting chain map.
- AppKit's network-switch UI is disabled. Yearn's chain context and vault widget own switching because they know
  how to resolve canonical IDs to Tenderly execution IDs.

WalletConnect sessions must approve the chains supplied by the adapter. Test custom Katana and Tenderly chain
switches with a real wallet; successful construction of the local Wagmi config does not prove that a remote
wallet accepts a custom execution chain.

## Wallet discovery and catalog policy

The local picker gives installed browser wallets the fastest path:

- Announced EIP-6963 connectors such as MetaMask, Rabby, or WalletChan are shown immediately and connected through
  AppKit's headless connector path, which delegates execution to the adapter-owned Wagmi connector.
- The generic injected connector is shown only when a legacy `window.ethereum` provider exists and no announced
  wallet is available.
- Auth, Base Account, Coinbase SDK, Safe, WalletConnect, and other non-browser connectors are not mislabeled as
  installed browser wallets.
- Phantom is excluded because this product supports EVM wallets only and does not need Phantom in its installed
  section.
- WalletConnect and **More wallets** delegate to AppKit. The remote catalog is limited to the maintained top-ten
  allowlist plus Safe; search and certification controls are hidden.

Coinbase SDK and Base Account are disabled. The bundler aliases the optional Base Account boundary to a
fail-closed local module because the connector barrel can otherwise pull optional payment/x402 code into the
build even when the feature is disabled.

## Reconnect ownership and embed isolation

In the top-level app, AppKit reconnect is enabled and `WagmiProvider` uses `reconnectOnMount={false}`. Browser
wallet connection and account disconnection use AppKit's public headless methods, so AppKit updates its own
connector history while the adapter continues to expose normal Wagmi state.

Safe and Ledger runtimes never initialize AppKit or its Universal Provider. They use separate Wagmi persistence
keys, disable injected-provider discovery, and register only the intended Safe or Ledger connector. A
single-flight guard prevents connector updates from starting a second handshake. With only one connector in each
isolated config, no cross-wallet selection or unrelated-session recovery is needed.

The required behavior is:

1. AppKit restores an authorized top-level injected or WalletConnect session once.
2. The app consumes the resulting Wagmi account state.
3. Explicit top-level disconnect clears the AppKit session so a reload stays disconnected.
4. Safe and Ledger runtimes connect only their dedicated connector and cannot read AppKit's main-tab state.
5. Explicit Safe or Ledger disconnect suppresses automatic reconnection until the user asks to connect again or
   reloads the embed.

The connection picker should open immediately. ENS, Clusters, token balances, and portfolio totals may continue
loading after connection; those background reads must not disable the account trigger. The account panel owns
its value skeleton while identity can fall back to the shortened address.

## Safe and Ledger iframe handling

Safe and Ledger embeds are special cases, not alternative global reconnect systems.

### Safe

When Yearn is framed by the exact secure origin `https://app.safe.global`, the embed config registers Wagmi's Safe
connector with the exact ID `safe`. Other origins containing the word "safe" are not trusted. Exact ID matching
also ensures wallets such as SafePal are not treated as a Safe smart account. The trusted Safe parent takes
precedence over other injected-provider markers so Safe batching cannot be displaced by a browser extension.

The vault widget receives `safe.isSafe = true` and keeps its existing Safe batch submission and Safe transaction
service tracking. Test this inside the real Safe application; ancestor-origin mocks are not a substitute for the
Safe provider handshake.

### Ledger

Yearn retains a dedicated connector with ID `ledger`. Current Ledger Wallet versions inject an EIP-1193 provider
with `isLedgerLive = true`; Yearn detects that provider even when its WebView is top-level and connects it
directly. Legacy non-Safe iframe integrations retain the historical WalletConnect `clientTwo` storage prefix so
existing authorized sessions continue to work.

The legacy connector is registered only inside the Ledger runtime. In the normal browser app, Ledger catalog
selection uses AppKit's visible WalletConnect flow; registering the hidden legacy connector there would consume
the selection without presenting its pairing URI.

The legacy connector has no independent pairing surface, so an unauthorized session is not started silently on
page load. This avoids a permanent loading state. New Ledger integrations should use the injected Ledger Wallet
provider; changing or removing the fallback requires acceptance testing in the legacy host.

## Required environment and Dashboard configuration

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is required in the repository-root `.env`. Yearn's Next configuration
loads that shared environment directory. AppKit does not provide a supported project-ID-free mode, so missing or
blank values must fail before a partial wallet stack is created.

Configure the corresponding Reown project before deployment:

1. Allow the exact Yearn production origin (`https://yearn.fi`) and any explicitly approved preview or local
   origins used for acceptance testing.
2. Use Yearn Finance metadata, the canonical `https://yearn.fi` URL, and a production Yearn icon.
3. Disable email and social login, swaps, on-ramp, send, receive, activity history, analytics, pay, smart
   sessions, and Reown authentication.
4. Disable Base Account and Coinbase SDK surfaces.
5. Keep wallet discovery enabled and restrict the WalletConnect catalog to the maintained allowlist.

AppKit `1.8.23` can give successfully fetched Dashboard feature settings precedence over local feature flags.
The Dashboard and source configuration must therefore agree. Always inspect the rendered production modal; a
passing unit test proves the local options, not the remote project response.

## Manual acceptance checks

Run the checks with the production Reown project configuration and representative production RPCs. Use a clean
browser profile when validating discovery and persistence.

### 1. Fast local picker

1. Open `/vaults` with MetaMask and Rabby installed.
2. Click **Connect wallet**.
3. Confirm the Yearn picker appears immediately without waiting for the remote wallet catalog, ENS, Clusters,
   balances, or portfolio data.
4. Confirm MetaMask and Rabby appear once each with their extension-provided names and icons.
5. Close by click-away and Escape on desktop, and by backdrop, close control, and Escape on mobile.
6. Confirm focus returns to the trigger and keyboard focus remains trapped in the mobile modal.
7. Start an extension connection and confirm the picker cannot be dismissed or start a second request until the
   extension approves or rejects the pending request.

### 2. Legacy and filtered providers

1. With only a legacy injected provider, confirm **Browser wallet** appears and connects.
2. With no injected provider, confirm it is shown as not detected/disabled while WalletConnect and **More
   wallets** remain usable.
3. With Phantom and an EVM extension installed, confirm Phantom is absent and the EVM wallet remains available.
4. Confirm Auth, Base Account, Coinbase SDK, Safe, WalletConnect, Ledger, and dev-agent connectors do not appear
   as detected browser extensions.

### 3. WalletConnect and curated wallets

1. Open WalletConnect and complete a QR pairing with a real mobile wallet.
2. Open **More wallets** and confirm only the maintained top-ten wallets plus Safe are offered.
3. Confirm search, certification labels, email/social login, swaps, on-ramp, send/receive, history, pay, and
   authentication surfaces are absent.
4. Reload and confirm the WalletConnect session reconnects once without an account-status flap.
5. Disconnect, reload twice, and confirm the session stays disconnected.

### 4. Connected account UI

1. Connect a wallet and immediately click the shortened address while identity and balances are still loading.
2. Confirm the Yearn account panel opens immediately and shows a value skeleton rather than blocking the trigger.
3. Confirm copy address, settings, theme selection, portfolio navigation, recent activity, and disconnect still
   work in light and every dark theme.
4. Repeat from mobile navigation and confirm the connection sheet does not stack underneath the navigation or
   account drawer.

### 5. Chain switching and transactions

1. Connect on a chain different from a selected vault's chain.
2. Start a deposit and a withdrawal and confirm the widget requests the required switch before approval or
   execution.
3. Repeat on Ethereum, Optimism, Polygon, Fantom, Base, Arbitrum, Sonic, and Katana where a test vault is
   available.
4. Confirm a cancelled switch produces a recoverable message and does not submit a transaction on the wrong
   chain.
5. Enable Tenderly mode and repeat on every configured mapping. Confirm the URL and vault data stay canonical
   while the wallet and RPC use the configured execution chain ID.

### 6. WalletChan atomic batching (ERC-5792)

1. Connect WalletChan through its announced EIP-6963 entry.
2. Choose a deposit that requires ERC-20 approval. Confirm the widget queries `wallet_getCapabilities` for the
   active account, connector, and target chain.
3. When `atomic.status` is `supported` or `ready`, confirm one `wallet_sendCalls` request is sent with atomic
   execution required and ordered calls for approval followed by deposit. A reset-required token may produce
   reset, approval, then deposit in the same ordered bundle.
4. Repeat with a withdrawal that needs approval and confirm approval plus withdrawal are submitted as one atomic
   bundle.
5. Confirm no parallel `eth_sendTransaction` is issued for the same batched action.
6. Confirm the UI polls the call-bundle status, resolves the mined receipt transaction hash, and uses that real
   hash for activity and explorer links rather than treating the bundle ID as a transaction hash.
7. Reject the bundle and confirm the widget reports cancellation without retrying sequentially or risking a
   duplicate submission.
8. Repeat with a wallet that reports unsupported or missing atomic capability. Confirm the established
   sequential approval and action flow still works.

### 7. Safe and Ledger embeds

1. Open Yearn inside `app.safe.global`, confirm the connected connector ID is exactly `safe`, and complete a
   transaction requiring multiple calls. Confirm the Safe batch and Safe transaction-service status are used.
2. Keep a top-level WalletConnect session active, then open and reload the Safe embed. Confirm the Safe connector
   wins without disconnecting the top-level session.
3. Open Yearn in a current Ledger Wallet WebView, confirm the injected provider reports `isLedgerLive = true`,
   connector ID is exactly `ledger`, and no AppKit or WalletConnect pairing modal opens.
4. Open the approved legacy non-Safe iframe with an existing `clientTwo` session and confirm it reconnects. With
   no authorized legacy session, confirm the page remains disconnected without a permanent loading state.
5. Reload and disconnect each embed flow to confirm its isolated behavior.

## Automated verification before release

At minimum, run:

```bash
bun run lint:fix
bun run tslint:all
bun run --cwd packages/wallet-ui test
bun run test:yearn
bun run test:ybold
bun run test:widget
bun run build:yearn
bun run build:ybold
```

Unit coverage should assert the local AppKit options, exact dependency/reconnect contract, curated wallet IDs,
browser-connector filtering, required project ID, multi-chain config construction, exact Safe and Ledger IDs,
and direct picker connection errors. The browser checks above remain required for extension injection,
WalletConnect relay behavior, Reown Dashboard overrides, custom chains, Safe Apps, and WalletChan batching.
