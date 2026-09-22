# Chain management and onboarding

The shared `@yearn/chains` workspace package owns chain metadata and app policy. Do not add new chain lists, pricing maps, native-token tables, or Enso allowlists in consumers.

## Add a chain

1. **Register it in `packages/chains/src/registry.ts`.** Import its Viem chain definition. If Viem does not provide one, use `defineChain` in this file with verified chain ID, native currency, public RPC, explorer, and applicable contract deployments. Add a registry entry with `chain`, `displayName`, and `prices` (an empty object is valid for direct-only use). Add `wrappedNative` if the native-token price must resolve through that contract. Never copy a wrapped-token or router address from another network without verifying it.
2. **Set app policy in `packages/chains/src/profiles.ts`.** Add an entry to each app that should offer it. ERC-4626 and yBOLD use `APP_PROFILES`; Yearn uses `YEARN_PROFILE`. App membership enables that app's wallet-chain configuration, not every optional integration. For Yearn configure the fields below. A registry entry alone does not enable a chain in any app.
3. **Configure individual RPC variables, if needed.** Keep one `NAME=value` entry per line in `.env` and the existing deployment injection setup. Yearn uses `NEXT_PUBLIC_RPC_URI_FOR_<id>`; ERC-4626 uses named variables such as `NEXT_PUBLIC_RPC_ROBINHOOD`; yBOLD uses `NEXT_PUBLIC_RPC_URL` for Ethereum. When adding a new override, add its explicit `process.env.NEXT_PUBLIC_...` binding to Yearn's `src/env.ts` or the standalone app's `lib/wagmiConfig.ts` / `lib/wagmi.ts`, and document it in `.env.example`. Next.js needs those literal reads to inline browser values. Apps assemble transport maps internally; there is no JSON environment variable. Public defaults apply when an override is absent. Rebuild after changing public values.
4. **Prepare external services for the enabled features.** Confirm Kong catalog/detail coverage, indexed history, provider prices and chain/token assets on the configured CDN. These services remain separate deployments. Configuration does not certify live coverage or a particular vault route.
5. **Run `bun run chains:check`, then the relevant checks.** Use `bun run test:chains`, `bun run tslint:all`, `bun run test:all`, and the affected app's production build. The configuration check is offline and requires no credentials. Add behavior tests when introducing a new capability or exception; ordinary chain additions should only require registry/profile edits and any explicit environment bindings described above.
6. **Verify a preview before launch.** Check network selection, vault loading, native balances, provider request keys, token suggestions and explorer links. Check deposits/withdrawals, approval spender matching, and optional Enso/history integrations where enabled. Keep unavailable data distinct from zero. A deployment entry for Enso does not guarantee support for all vaults or cross-chain routes.

### Yearn policy fields

| Field | Meaning |
| --- | --- |
| `id` | Registered canonical chain ID. Entry order preserves wallet order and V2 filter order. |
| `vaults` | Versions listed by the app: `v2`, `v3`, or both. Omit for wallet-only compatibility. |
| `vaultOrder` | Ordering for the all-vaults and V3 chain filters. Required for listed vault chains. |
| `v3Filter` | Optional `primary` or `secondary` placement; requires V3 listing. |
| `nativeBalance` | Include the native-currency balance token. |
| `rpcBalanceFallback` | Read token balances through RPC instead of Enso balances. Independent of Enso routing support; currently enabled for Fantom. |
| `history` | Include the chain in holdings-history discovery. Configure both provider identifiers because the service supports selecting either provider. This does not enable upstream indexing. |
| `ensoOrder` | Enable the chain in the Enso token-routing selector, at this order. Requires a documented router in the registry. |
| `depositTokens`, `withdrawTokens` | Ordered common-token suggestions for the corresponding operation. |
| `rpcDefault` | Optional app-specific public RPC default; otherwise use the Viem definition's default. |

Example policy for a registered direct-only chain:

```ts
// In APP_PROFILES.erc4626:
{ id: 4663 }
```

Example public override:

```dotenv
# Yearn:
NEXT_PUBLIC_RPC_URI_FOR_4663=https://rpc.mainnet.chain.robinhood.com

# ERC-4626 (its own .env):
NEXT_PUBLIC_RPC_ROBINHOOD=https://rpc.mainnet.chain.robinhood.com
```

The registry's `prices` object uses separate `'yearn-prices'` and `defillama` identifiers. Do not infer either from a website slug. `enso` contains `router` and an official deployment `source` URL. These are reviewed metadata, not live availability flags.

## Environment compatibility and precedence

Apps retain their explicit individual environment reads. The shared package receives an ordinary JavaScript map and does not inspect the process environment. No environment-name migration or deployment injection changes are required.

- Yearn: Tenderly execution override, then `NEXT_PUBLIC_RPC_URI_FOR_<id>`, an explicit profile `rpcDefault`, and older transport fallbacks. Existing `NEXT_PUBLIC_JSON_RPC_*` handling remains unchanged.
- ERC-4626: `NEXT_PUBLIC_RPC_ETHEREUM`, `NEXT_PUBLIC_RPC_BASE`, `NEXT_PUBLIC_RPC_ARBITRUM`, `NEXT_PUBLIC_RPC_OPTIMISM`, `NEXT_PUBLIC_RPC_POLYGON`, or `NEXT_PUBLIC_RPC_ROBINHOOD`, then the app profile's public default.
- yBOLD: `NEXT_PUBLIC_RPC_URL` applies to Ethereum, then the profile's public default. Additional chains need their own explicit binding.
- Yearn server enrichment: private `RPC_URI_FOR_<id>` takes priority over `NEXT_PUBLIC_RPC_URI_FOR_<id>`. Timelock and receipt enrichment still require explicit configuration; they do not silently start using a public fallback. Optimization retains its ordered feature-specific defaults in the registry.

Public configuration is shipped to the browser. Do not put server-only keys or Tenderly Admin RPC credentials in public variables.

Tenderly remains a Yearn-owned execution overlay. This refactor retains its existing opt-in configuration and filtering behavior. Canonical IDs identify vaults and pricing; execution IDs identify the chain used for transactions and receipts. Do not substitute a production RPC for an unavailable fork. New Tenderly forks still use the existing Tenderly setup workflow and explicit environment bindings; they are not part of ordinary production-chain onboarding.

## Ownership and compatibility

- `registry.ts`: Viem definitions, display names, wrapped native tokens, provider identifiers, verified router addresses, and existing optimization RPC defaults.
- `profiles.ts`: explicit app membership, feature enablement, order and token suggestions. yBOLD remains Ethereum-only; ERC-4626 remains direct-only. Metadata-only pricing chains remain outside wallet profiles.
- `selectors.ts`: derived chain sets, price mappings, wrappers, routing choices and suggestions.
- `rpc.ts`: pure endpoint precedence helpers for maps assembled by each host.
- `validation.ts`: offline cross-configuration checks, run in CI through `test:all`.

Feature-specific deployments such as strategy timelocks and executors stay with their owning feature; their chain lookup and explicit RPC resolution use shared helpers. Adding a chain does not imply a timelock deployment.

The widget runtime accepts `chains.selectableChains` from its host for the token-routing selector. A host that does not supply it gets no cross-chain choices. Yearn supplies its routing profile; direct-only hosts leave it empty. The existing widget address/price/token helper exports remain compatibility wrappers over the shared metadata. External hosts can still inject their chain lookup and execution mapping without importing app code.

Legacy app lists and address constant names are compatibility exports, not places to register a chain. The broad Viem metadata lookup in Yearn remains for existing callers; being discoverable there does not enable an app feature.

## Migration behavior

The app chain sets, vault ordering, router trust addresses, and token suggestions from the parent PR are preserved. Sonic's existing absence from native balance-token and history queries is preserved explicitly. Names and currency labels now derive from chain metadata instead of separate hand-written lists. The vault-list loading state derives its networks from the same profile as the loaded page.

Enso enablement now checks the routing profile before presenting a route on a chain without a configured router. Unknown chains are not mapped to Ethereum. Missing optional pricing or routing metadata does not prevent registering a direct-only chain.
