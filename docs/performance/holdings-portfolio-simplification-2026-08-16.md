# Holdings portfolio simplification benchmark

Date: 2026-08-16
Current route: `GET /api/holdings/portfolio`
Compared route: `GET /api/holdings/ledger/portfolio` from PR #1352

## Result

The simplified implementation reaches the previous ledger's cold and seven-day performance range without keeping a durable normalized ledger, synchronization marker, revision graph, reconciliation process, or derived portfolio cache.

The release-build heavy-wallet cold request completed in **21.85s**, inside the previous implementation's controlled **18.86–23.61s** range and down from **70.48s** for the original correct sequential implementation on this branch. A seven-day repair completed in **22.67s**, effectively equal to the old controlled **22.71s** result. The repaired response matched the cold response exactly after removing only protocol/growth generation timestamps.

## Fixtures and method

All current measurements used a production Next build on `http://127.0.0.1:3010`, `version=all`, `denomination=usd`, and `timeframe=1y`.

- Heavy wallet: `0x93A62dA5a14C80f265DAbC077fCEE437B1a0Efde`
- Smaller wallet: `0x96A489A533bA0913dD8E507e6D985a45BC783566`
- Current cold setup: delete only each wallet's `wallet-events:v2`, `totals:v2`, and `protocol-return-history:v4` keys and verify absence.
- Seven-day setup: retain 358 daily-total fields, remove `2026-08-09` through `2026-08-15`, and remove the event and protocol snapshots.
- HTTP wallet responses use `private, no-store`; no browser or CDN response cache participated.
- Upstream Kong, Envio, and Yearn Prices caches cannot be flushed, so cold latency remains subject to provider variance.

The PR-preview samples were taken from the deployed preview after deleting its exact wallet-scoped Redis keys. The older controlled ranges come from `holdings-wallet-ledger-portfolio-optimization.md`; remote-preview and local-production timings should not be treated as identical environments.

## Performance

| Wallet / path | Previous ledger | Simplified release | Result |
| --- | ---: | ---: | --- |
| Heavy cold | 20.19s preview; 18.86–23.61s controlled | **21.85s** | Inside controlled range |
| Smaller cold | 2.04s preview; 5.40–8.10s controlled | **7.29s** | Inside controlled range |
| Heavy immediate warm | 0.37s controlled median | **1.65s median** (2.25s, 1.39s, 1.65s) | 92.5% below simplified cold |
| Heavy event cache removed | 6.57s old expired-warm | **1.39s** | Final caches avoid event loading |
| Heavy seven-day repair | 22.71s controlled | **22.67s** | Equivalent |

Response sizes were 1,296,100 bytes for the heavy wallet and 712,727 bytes for the smaller wallet. All measured requests returned HTTP 200.

The bounded daily-range helper was material to heavy cold performance: before the helper, the same release candidate and global provider limit took 28.12s. The helper reduced the heavy balance price plan from 396 small batches to 7 range batches while adding only bounded filler points.

## Correctness

- The heavy cold body and all three immediate-warm bodies were byte-for-byte identical.
- Removing only the five-minute event snapshot still produced a byte-for-byte identical body.
- The seven-day repair matched the cold body after deleting only `protocolReturn.generatedAt` and `growth.generatedAt`.
- Focused price-index tests preserve exact lookup results; the index changes only lookup complexity.
- Both pagination compatibility modes use bounded 1,000-row pages. The former 50,000-row query was removed because Envio can cap it at 1,000 rows without reporting truncation.
- Yearn Prices HTTP work has one process-wide 12-request FIFO limit, including concurrent balance, receipt-price, and ETH-price consumers. Recursive splits release their permit before starting child requests.

The old preview's pricing anomaly is not reproduced:

| Date | Previous ledger | Simplified release |
| --- | ---: | ---: |
| 2025-10-24 | $17,698,411 | $17,530,587 |
| 2025-10-25 | **$31,528,373,331,587** | **$17,754,448** |
| 2025-10-26 | $31,528,373,336,762 | $17,667,924 |
| 2025-10-27 | $31,528,373,664,266 | $17,994,007 |

The old ledger's daily fallback accepted the first finite positive exact-day price without an outlier sanity check. That fallback was not ported. The simplified daily balance path uses the provider result materialized for the exact requested UTC day; it does not carry an arbitrarily older daily price into a missing day. Protocol-return event-time pricing keeps its prior-price semantics.

## Cache model

| Cache | Shape | Lifetime | Invalidation |
| --- | --- | ---: | --- |
| Wallet events | One Brotli value per wallet + settled cutoff | 5 minutes | TTL, cutoff change, corrupt/oversized payload |
| Balance totals | One Redis hash; one field per UTC date | 30 days from the latest write | Relevant vault invalidation marker or TTL |
| Protocol return + growth | One atomic JSON snapshot per wallet/version/timeframe/scope | Up to 24 hours | Settled-date mismatch, vault invalidation marker, or TTL |
| Browser query | TanStack Query entry | 1 hour | Client query lifecycle / explicit refetch |

The protocol snapshot's effective life is often shorter than 24 hours: it must also match the current latest settled UTC date. Growth is part of that same snapshot, not a fourth server cache.

### Cold

1. Balance totals and protocol snapshot are checked in parallel.
2. On misses, one deferred settled context is shared by both calculations.
3. Global vault metadata prefetch overlaps six bounded Envio event streams.
4. The complete wallet event set is stored for five minutes.
5. Timeline construction, metadata, and PPS are shared. Balance values missing dates; protocol return enriches and evaluates its full path-dependent history; growth is derived from the same final vault results.
6. Daily totals are written to the hash, and protocol return plus growth are written as one settled-date snapshot.

### Warm

1. Protocol return plus growth load from their atomic snapshot and validate its vault invalidation markers.
2. A complete daily-total range uses the vault list from that protocol snapshot for validation.
3. The deferred wallet context is never invoked, so no event, metadata, PPS, or historical-price fetch is required.

This is why deleting or naturally expiring only the five-minute event value does not slow a true warm request.

### Seven-day tail

1. The totals hash contributes the 358 retained dates; only seven dates are missing.
2. The event value has expired and the protocol snapshot no longer matches the new settled day, so the shared wallet context is rebuilt once.
3. Balance price/PPS work is limited to the seven missing dates.
4. Protocol return and growth remain path-dependent and recalculate the full requested history.
5. Seven total fields are added, refreshing the hash's 30-day TTL; the event and protocol snapshots are rewritten with their normal TTLs.

The tail remains roughly as expensive as cold because protocol return and growth, not the seven balance points, dominate the critical path.

## What was retained from PR #1352

- One combined portfolio endpoint.
- One short-lived compressed wallet-event value.
- Date-partitioned daily totals.
- One atomic protocol-return/growth snapshot.
- Shared request context and in-flight PPS work.
- Bounded parallel Envio pages.
- Bounded provider concurrency and small timestamp indexes.
- A bounded 15% / 10,000-point / 366-day range filler for daily balance price requests.

## What was removed

- Durable wallet-ledger schema and revision bookkeeping.
- Checked marker, wallet lock, ownership fencing, and synchronization state machine.
- Bootstrap/incremental reconciliation and periodic repair logic.
- Separate normalized event-storage and coverage models.
- Derived portfolio cache keyed to ledger revisions.
- Valuation loader with consumer priorities, promotion queues, and pending registries.
- Address-only transaction shortcut that changed protocol enrichment behavior.
- Broad compatibility/fallback paths tied to the ledger architecture.

The result has three wallet-scoped cache values in the common case instead of a ledger subsystem. It preserves the existing calculators and makes caching an optimization around them rather than a second source of truth.
