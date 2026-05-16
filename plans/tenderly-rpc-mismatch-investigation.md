# Tenderly RPC Mismatch Investigation

## Context

Outcome-test RPC cataloging compared the same connected watch-wallet interaction
paths in normal generic RPC mode and in `VITE_TENDERLY_MODE=true`.

The UI behavior matched: the same scenarios passed in both modes. The network
profile did not match:

| Interaction cluster | Generic mode | Tenderly mode |
| --- | ---: | ---: |
| Vaults search/filter/sort | 8 generic RPC | 201 Tenderly RPC |
| Vault Detail tabs | 21 generic RPC | 552 Tenderly RPC |
| Vault Detail wallet controls | 46 generic RPC | 391 Tenderly RPC |
| Portfolio tabs/chart/claim | 28 generic RPC | 202 Tenderly RPC |

## Finding

The mismatch does not appear to come from the Tenderly VNet bootstrap scripts.
Those scripts create/read Tenderly RPC mappings and admin RPC helpers, but the
large call-count difference is explained by frontend runtime routing.

When Tenderly mode is enabled:

1. `src/config/tenderly.ts` parses `VITE_TENDERLY_CHAIN_ID_FOR_*` and
   `VITE_TENDERLY_RPC_URI_FOR_*`, then exposes the configured canonical chain
   ids via `getTenderlyBackedCanonicalChainIds()`.
2. `src/components/shared/hooks/useBalancesCombined.ts` appends those
   Tenderly-backed canonical chain ids to `ENSO_UNSUPPORTED_NETWORKS`.
3. `src/components/shared/hooks/useBalancesRouting.ts` routes tokens on those
   chains to multicall instead of Enso.
4. `src/components/shared/hooks/useBalances.multichains.ts` builds ERC-20
   metadata and `balanceOf` calls for every routed token and executes them
   through wagmi `multicall` on the Tenderly execution chain.

That is intentional enough to have a test:

`src/components/shared/hooks/useBalancesRouting.test.ts`

```ts
it('routes Tenderly-backed canonical chains to multicall when Enso is disabled for them', ...)
```

## Why It Shows Up As Hundreds Of Tenderly Requests

Normal mode can satisfy most wallet balances through Enso, so the browser makes
few RPC calls.

Tenderly mode cannot safely use Enso for fork-specific balances, because Enso
would return canonical-chain state rather than VNet state. The app therefore
falls back to on-chain balance discovery via Tenderly RPC. For a connected wallet
and a full Yearn token/vault catalog, that becomes many ERC-20 metadata and
`balanceOf` reads.

The outcome-test telemetry shows those as large batched `eth_call` bursts. JSON-
RPC method counts can be larger than HTTP POST counts because requests may carry
batched calls.

## Likely Optimization Direction

Keep Tenderly balance reads on-chain, but reduce the number of tokens sent to
multicall for common browsing paths.

Candidate approaches:

- Query only visible/relevant vault tokens first, then progressively hydrate the
  rest.
- Keep Enso for display-only catalog data and use Tenderly multicall only for
  wallet-critical values that can change in the VNet.
- Add a Tenderly-specific balance token scope for outcome tests and local
  transaction workflows.
- Increase multicall packing efficiency only after reducing the token set; bigger
  batches alone will not address the total contract-call volume.

## Current Assessment

The Tenderly scripts are probably not the source of the mismatch. The mismatch is
the expected side effect of this runtime choice:

Tenderly mode trades low generic-RPC usage for fork-correct wallet balances by
routing Tenderly-backed chains away from Enso and into multicall.
