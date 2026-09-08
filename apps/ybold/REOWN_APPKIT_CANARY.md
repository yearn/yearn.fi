# Reown AppKit integration

This yBOLD integration was the first, deliberately narrow wallet-connection canary. Reown AppKit owns wallet
discovery, connection UI, injected and WalletConnect connections, automatic reconnect, and ordinary Safe App
connection. Wagmi and Viem remain the execution substrate. The existing `@yearn/vault-widget` runtime,
transaction planning, and Wagmi execution adapter are unchanged consumers of the adapter-owned Wagmi config.

## Compatibility

- `@reown/appkit` and `@reown/appkit-adapter-wagmi` are pinned together at `1.8.23`.
- The adapter requires Wagmi `>=2.19.5`, `@wagmi/core >=2.21.2`, and Viem `>=2.45.0`. This workspace stays on
  Wagmi 2 and pins yBOLD's compatible matrix to Wagmi `2.19.5`, Core `2.22.1`, connectors `6.2.0`, and Viem
  `2.55.11`. Wagmi itself pins the matching connectors version.
- Yearn, yBOLD, the shared wallet UI, and the shared vault widget all use the workspace's Wagmi `2.19.5`
  version. Wagmi's React context is module-local, so yBOLD's bundlers explicitly resolve linked workspace
  package imports to the app's Wagmi instance. This remains necessary because Bun can materialize an app-local
  copy even when its version matches the root copy.
- AppKit is substantially larger than the repository's normal SDK dependency threshold. Bundlephobia reports
  approximately 902 kB minified / 264 kB gzip for AppKit and 310 kB / 85 kB for its Wagmi adapter. The canary
  replaces RainbowKit rather than shipping both wallet UIs.

## Deliberate configuration

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is required in the shared repository-root `.env`. yBOLD loads the same
  environment directory as `apps/yearn`; app-local `.env.local` files are not part of this setup. AppKit does not
  document or support a project-ID-free injected-only mode, so the old silent fallback is not retained.
- yBOLD remains Ethereum-mainnet-only. `NEXT_PUBLIC_RPC_URL` is still the first transport and still falls back
  to `https://ethereum-rpc.publicnode.com` when unset. AppKit appends its own Blockchain API fallback for
  supported networks after the supplied transport.
- Injected/EIP-6963 discovery is explicitly enabled. Wallet discovery and the full wallet list remain enabled so
  WalletConnect QR/deep links are available without relying on AppKit's deprecated WalletConnect flag. Coinbase
  SDK and Base Account auto-connectors are disabled; Safe App connection is added by the AppKit Wagmi adapter
  when it detects a Safe iframe.
- Wagmi connectors `6.2.0` pulls Base Account's optional payment SDK into its connector barrel even when Base
  Account is disabled, and that SDK expects optional x402 packages that this canary deliberately does not install.
  Both application bundlers alias the disabled Base Account boundary to a fail-closed module. This keeps Safe support
  intact while ensuring Base Account and x402 cannot become an accidental wallet or payment surface.
- AppKit reconnect is explicitly enabled. `WagmiProvider.reconnectOnMount` is disabled so AppKit is the single
  reconnect owner, and the shared local picker plus account disconnect use AppKit's public headless methods so
  reconnect history stays aligned while the rest of the app consumes Wagmi account state.
- Email and social login, swaps, on-ramp, send, receive, activity history, analytics, pay, smart sessions, and
  Reown authentication are disabled in local configuration. AppKit 1.8.23 gives successfully fetched Reown
  Dashboard feature settings precedence over these local flags, so the same features must also be disabled on
  the yBOLD Reown project before deployment. Confirm the rendered modal as part of release acceptance.

## Connection acceptance checks

Run these with the configured yBOLD Reown project and the production RPC setting:

1. Open the AppKit button with no injected provider. Confirm WalletConnect discovery and QR pairing are present,
   and email/social, swap, on-ramp, send/receive, and activity surfaces are absent.
2. Connect an injected EIP-6963 wallet, reload, and confirm the same address and mainnet connection return without
   a second prompt or account-status flap. Disconnect, reload, and confirm it stays disconnected.
3. Pair a wallet through WalletConnect, reload, and confirm the session reconnects once. Disconnect, reload, and
   confirm the session is not restored.
4. Load yBOLD inside `app.safe.global`, confirm the connector ID is `safe`, and confirm the unchanged vault widget
   plans a Safe batch rather than an EOA transaction.

The unit contract covers the enabled connector/reconnect flags, required project ID, RPC selection, and exact Safe
connector identity. A production-build smoke with a placeholder project ID and mock EIP-6963 provider confirmed
the local modal offered WalletConnect and the injected provider without auth surfaces, restored the injected
address after reload, and kept it disconnected after a disconnect and second reload. A real extension, valid
Reown project, WalletConnect peer, and Safe iframe are still required for the end-to-end checks above.
