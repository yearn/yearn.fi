# Wallet and widget analytics

Both applications use the existing Plausible tracker. New events carry `app=yearn|ybold`. No Reown SDK, authentication, additional wallet RPC calls, or signing requests are involved.

## Wallet selection

| Event | Meaning |
| --- | --- |
| `wallet_picker_open` | Our initial picker opened. Includes `entry_point=header|widget|portfolio|other` and `device=desktop|mobile`. |
| `wallet_connect_started` | A detected wallet, WalletConnect, or More wallets was selected. |
| `wallet_connect_result` | An unsuccessful attempt ended: `error`, `rejected`, `superseded`, or `closed_without_connection`. |
| `connect_wallet` | A user-requested connection succeeded. This preserves the existing event and its `connector` and `chainID` properties; it is emitted once. Automatic restoration is excluded. |
| `wallet_picker_closed` | The picker journey ended without a connection. Includes its last outcome and number of attempts. |

An attempt is one initial-picker selection. `path=detected|walletconnect|more_wallets` records that selection, independently of `wallet_name` and `connection_method=injected|walletconnect|safe_sdk|sdk|unknown`.

Success includes `used_more_wallets`, `initially_visible`, `attempt_number`, `had_previous_failure`, and duration buckets. `initially_visible` compares the successful wallet brand with the initial suggestions locally; the installed-wallet list is never sent. Unrecognized brands report `unknown`. WalletConnect brand attribution reads the public session's peer metadata after connection, with a bounded wait that does not delay the UI. The name is metadata, not a verified identity.

Detected connections have `attempt_scope=connector_request`. RainbowKit's public APIs expose secondary-screen visibility and the successful connector, but do not expose every internal wallet selection, rejection, or retry. Those paths have `attempt_scope=secondary_screen`; closing the screen is not classified as rejection. Desktop WalletConnect opens QR; mobile WalletConnect can open the secondary wallet picker. Closing/reopening starts another journey. In-flight results from abandoned attempts cannot finish a newer journey.

Useful questions:

- **Are suggestions enough?** Break down `connect_wallet` by `path`, `used_more_wallets`, and `initially_visible`. More-wallets success with `initially_visible=false` identifies brands worth considering for the initial picker.
- **Is More wallets a first choice or recovery?** Filter `wallet_connect_started` by `path=more_wallets`, then compare `first_choice` and `had_previous_failure`.
- **Which wallets struggle?** Compare detected-connection successes, rejections, and errors by `wallet_name`, `connection_method`, device, and duration. Keep secondary-screen outcomes separate.

Yearn's existing explicit disconnect and network-change events retain their current ownership. This change does not add restoration or disconnect events to yBOLD, or new tracking to Yearn's legacy Ledger/dev-wallet entry points.

## Widget execution

| Event | Meaning |
| --- | --- |
| `widget_flow_started` | The transaction overlay opened for a deposit, withdrawal, stake, or unstake. |
| `widget_step_started` | An execution step started, including a retry or chain switch. |
| `widget_step_result` | A step was signed, submitted, confirmed, awaiting Safe execution, rejected, failed, or became unknown. Submission is not confirmation. |
| `widget_flow_result` | The observed flow succeeded, or the overlay closed with an error, rejection, pending/unknown outcome, or before a request. |
| `deposit`, `withdraw` | Existing completion callbacks, enriched with execution context. Their existing timing is preserved; use `widget_flow_result` for confirmed-flow reporting. |

Dimensions:

- `action`: deposit, withdraw, stake, unstake.
- `route`: direct route names, `enso_zap_in`, `enso_zap_out`, `ybold_zap_in`, `ybold_zap_out`, `yvusd_locked_zap_in`, or `yvusd_locked_zap_out`.
- `source_chain`, `destination_chain`, and withdrawals' `withdrawal_source`.
- `execution_mode`: `transaction`, `atomic_batch`, `safe_transaction`, `safe_batch`, or `permit`; step events include `call_count` and `completes_flow`.
- `batch_capability`: supported, ready, unsupported, pending, unknown, error, or safe. This reuses the existing capability query.
- `batch_reason`: eligible, approval_not_needed, wallet_unsupported, capability_unknown, capability_error, or route_or_preparation_unavailable.
- `attempt_number` per step, `retry_count` and `step_count` per flow, and `batch_used` if any batched request was attempted. Approval followed by deposit is two steps, not a retry. Closing/reopening starts a new flow.
- `stage`: wallet_request, network_switch, or confirmation. `completion_stage=execution` means the final execution was confirmed; `destination_delivery` means a cross-chain delivery was observed. Legacy completion callbacks can carry `source_confirmation` when destination observation is unavailable.
- `error_category`: bounded categories, never raw wallet/RPC error text. Rejection is separate from technical failure.

Safe submission is awaiting execution. Cross-chain source confirmation does not complete the analytics flow; delivery must be observed. Closing while pending produces `pending_or_unknown`. Analytics do not persist transaction identifiers or track confirmation after the overlay closes, navigation, or reload. A hard page exit can leave a flow without a closing event. Existing notification tracking continues independently.

There is no automatic sequential fallback after a rejected/failed batch. Analytics do not add one. Standalone approval-settings overlays and non-widget legacy transaction overlays are outside this funnel.

## Plausible setup and interpretation

Create custom-event goals for the events above in the existing Plausible site, then create separate [property-filtered goals and funnels](https://plausible.io/docs/custom-props/for-custom-events):

1. Wallet: picker open → attempt started → `connect_wallet`, split by path and app.
2. Widget: flow started → step started → flow result filtered to `outcome=success`, split by action, route, execution mode, and app.
3. Batch usage: compare actual batch step starts against eligible flows/first steps. Do not include `approval_not_needed` in the eligible denominator.

Plausible visitor funnels are not request counters. Use event totals with matching scope for request/error rates, and flow-result totals for final observed outcomes. A step can emit both submitted and confirmed events; filter by outcome rather than adding all result events. Report pending/unknown and abandoned flows separately instead of treating them as failures. Recovery within one open flow is directly available through `retry_count` or `had_previous_failure`; no cross-visit retry stitching is attempted.

yBOLD defaults to the existing `yearn.fi` site, uses `/proxy/plausible/api/event`, and can override the site with `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Both apps disable localhost collection by default; `NEXT_PUBLIC_PLAUSIBLE_TRACK_LOCALHOST=true` enables explicit local QA. Intercept event requests during automated QA to keep test traffic out of production analytics. No dashboard configuration is performed by this code change.

New funnel events do not add wallet addresses, ENS, transaction hashes, amounts, signatures, call data, raw errors, or persistent/session identifiers. Existing `deposit`/`withdraw` properties (vault/token contracts, amounts, values) are preserved. Legacy `connect_wallet.connector` is preserved; use the bounded `wallet_name` field for comparisons.

## Verification

Regression tests cover attempt ownership, duplicate suppression, metadata timeouts, retry counting, Strict Mode, rejected and failed batches, Safe execution, and closing pending cross-chain flows. Browser smoke checks with mock Rabby and WalletChan providers passed on desktop and mobile in both apps, including rejection/retry, connection, automatic restoration without a duplicate event, and disconnect. Yearn also passed More wallets dismissal and QR dismissal/reopening. Requests were intercepted before reaching Plausible.

In that local development smoke run, picker opening took 87–160 ms and mock connection took 61–186 ms; a subsequent Yearn QR test measured 119 ms and 288 ms respectively. These timings include browser automation overhead, exclude initial hydration and real extension prompts, and are not a before/after performance comparison.

Still test live extension prompts, mobile deep links, WalletConnect pairing/peer metadata, and funded transactions before release. The local yBOLD environment has no WalletConnect project ID, so its secondary-screen browser path still needs checking with that configuration. Create/verify the Plausible goals and funnels after deployment.
