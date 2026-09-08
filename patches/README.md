# Reown AppKit 1.8.23: wallet readiness

The pinned Bun patch adds `ready({ walletsOnly: true })`. It waits for adapter
initialization and both session-restoration steps, but not the subsequent remote
feature configuration and project-usage requests. Those requests still run;
ordinary `ready()` retains its original full-startup behavior.

The shared wallet helper uses the shorter barrier only for injected browser
wallets. WalletConnect and other connector types retain full readiness. Do not
replace this with a connector-discovery check: discovery precedes restoration,
which could otherwise overwrite a fresh connection.

`packages/wallet-ui/src/appkitReadiness.test.ts` exercises the installed SDK's
actual initialization methods with delayed restoration/configuration/usage.
Keep the patch when installing; remove it when upstream exposes equivalent
wallet readiness and the shared helper has been migrated.

Development-only `[wallet-connect]` startup logs time connector discovery,
WalletConnect provider initialization/registration, and the two restoration steps.
They contain stage names and timings only. Capture them from page load, not just
from the connect button click.

# Reown Wagmi adapter 1.8.23: empty restoration list

The adapter filters its saved connections before calling Wagmi `reconnect`.
When that list is empty, Wagmi interprets `connectors: []` as "all configured
connectors". The adapter patch returns early instead, avoiding unsolicited
extension checks and reconnection of deliberately excluded wallets.

The installed-adapter regression tests in `appkitReadiness.test.ts` cover an
empty eligible list, explicit disconnection, and a saved eligible connector.
