# Withdraw Zap USD Amounts Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix the yearn.fi withdraw zap flow so the output USD amount is computed from raw quote data instead of compact display text, and add the missing USD values to the withdraw details section for zap flows.

**Architecture:** Keep the quote math in the withdraw flow, where raw `bigint` quote values and token decimals already exist. Pass either raw amount metadata or preformatted USD strings into presentational components so `InputTokenAmount` and `WithdrawDetails` do not have to reverse-engineer values from compact strings like `16.1K`. Reuse existing shared formatting utilities (`formatCounterValue` / `formatAmount`) instead of introducing a new currency formatter.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Wagmi/Viem, shared formatting helpers in `src/components/shared/utils/format.ts`

---

## Problem statement

The current withdraw zap UI has two related bugs:

1. In `InputTokenAmount.tsx`, the zap output USD value is derived from `parseFloat(zapToken.expectedAmount) * outputTokenUsdPrice`. In withdraw flows, `expectedAmount` is currently built with `formatWidgetValue(...)`, which intentionally produces compact text like `16.1K`. `parseFloat('16.1K')` becomes `16.1`, so the UI shows `$17.85` instead of roughly `$17,850`.
2. The withdraw details section (`WithdrawDetails.tsx`) currently shows token quantities for zap rows but does not show their USD equivalents, matching the second screenshot in `/home/dev/todos/images/withdraw-zap-usd-amounts/`.

## Known evidence

- To-do entry: `/home/dev/todos/todo.md:65-75`
- Screenshot 1: `/home/dev/todos/images/withdraw-zap-usd-amounts/incorrect-usd-display.jpg`
- Screenshot 2: `/home/dev/todos/images/withdraw-zap-usd-amounts/more-info-missing-usd-values.jpg`
- Current buggy code:
  - `src/components/pages/vaults/components/widget/InputTokenAmount.tsx:95-102`
  - `src/components/pages/vaults/components/widget/withdraw/index.tsx:525-540`
  - `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx:102-136`

## Acceptance criteria

- In withdraw zap mode, the zap output USD line under the selected output token uses the raw quote amount and renders the correct order of magnitude.
- The withdraw details section shows USD equivalents for the zap rows that currently only show token amounts.
- Non-zap withdraw flows are visually unchanged.
- Existing `InputTokenAmount` behavior outside withdraw zaps remains unchanged.
- New tests fail before the fix and pass after the fix.

---

### Task 1: Document the intended UI contract for zap USD display

**Objective:** Lock down exactly which rows should show USD values so implementation does not drift.

**Files:**
- Modify: `plans/2026-04-06-withdraw-zap-usd-amounts.md`
- Reference: `/home/dev/todos/todo.md:65-75`
- Reference: `/home/dev/todos/images/withdraw-zap-usd-amounts/incorrect-usd-display.jpg`
- Reference: `/home/dev/todos/images/withdraw-zap-usd-amounts/more-info-missing-usd-values.jpg`

**Step 1: Confirm target rows from current code**

Inspect:
- `src/components/pages/vaults/components/widget/InputTokenAmount.tsx`
- `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx`
- `src/components/pages/vaults/components/widget/withdraw/WithdrawDetailsOverlay.tsx`

Expected finding:
- The first screenshot maps to the zap token section in `InputTokenAmount`.
- The second screenshot most likely maps to the inline details rows in `WithdrawDetails`, not the overlay component.

**Step 2: Freeze the expected copy/layout before coding**

Use this exact rule during implementation:
- Zap output chip under the target token: show a correct USD value.
- In `WithdrawDetails`, for zap flows show USD values for:
  - `You will swap`
  - `You will receive at least`
- Do not add USD values to non-zap rows unless required to support the zap display.

**Step 3: Verification note**

When implementation is complete, manually compare the result against the screenshots and ensure the displayed USD order of magnitude is consistent with the input amount.

**Step 4: Commit**

No commit for this task alone; it is specification work for the following code tasks.

---

### Task 2: Write failing tests for the compact-value parsing bug in `InputTokenAmount`

**Objective:** Reproduce the broken `$17.85` style behavior in a component test before changing code.

**Files:**
- Modify: `src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx`
- Modify later: `src/components/pages/vaults/components/widget/InputTokenAmount.tsx`

**Step 1: Add a failing test for zap USD rendering from raw quote metadata**

Add a test similar to:

```tsx
it('renders zap output USD from raw quote amounts instead of compact display text', async () => {
  const InputTokenAmount = await loadInputTokenAmount()
  const html = renderToStaticMarkup(
    <InputTokenAmount
      input={[
        {
          formValue: '17900',
          activity: [false, vi.fn()],
          decimals: 18
        },
        vi.fn(),
        vi.fn()
      ] as never}
      symbol={'crvUSD'}
      inputTokenUsdPrice={1}
      outputTokenUsdPrice={1.11}
      zapToken={{
        symbol: 'yvUSDC-2',
        address: '0x0000000000000000000000000000000000000003',
        chainId: 1,
        expectedAmount: '16.1K',
        expectedAmountRaw: 16100_000000n,
        expectedAmountDecimals: 6
      }}
    />
  )

  expect(html).toContain('$17,871')
})
```

Notes:
- Use whatever exact raw amount/price pair is easiest to assert deterministically.
- The test should prove the component no longer depends on `parseFloat('16.1K')`.

**Step 2: Run the focused test to verify failure**

Run:
`bunx vitest run src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx`

Expected: FAIL — new prop fields are missing and/or the HTML still contains a mis-scaled USD amount.

**Step 3: Keep the existing tests green in the same file**

Do not weaken the logo/balance tests already present in this file.

**Step 4: Commit**

```bash
git add src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx
git commit -m "test: cover withdraw zap usd display regression"
```

---

### Task 3: Fix zap output USD display in `InputTokenAmount`

**Objective:** Stop deriving USD from compact display strings and use raw quote data or an explicitly formatted USD string.

**Files:**
- Modify: `src/components/pages/vaults/components/widget/InputTokenAmount.tsx`
- Modify: `src/components/pages/vaults/components/widget/withdraw/index.tsx`
- Reference: `src/components/shared/utils/format.ts:653-662`

**Step 1: Extend the zap token contract with raw-amount metadata**

Change the `zapToken` type in `InputTokenAmount.tsx` from:

```ts
zapToken?: {
  symbol: string
  address: string
  chainId: number
  expectedAmount?: string
  isLoading?: boolean
}
```

to something like:

```ts
zapToken?: {
  symbol: string
  address: string
  chainId: number
  expectedAmount?: string
  expectedAmountRaw?: bigint
  expectedAmountDecimals?: number
  isLoading?: boolean
}
```

**Step 2: Replace the buggy USD calculation**

Remove the current logic:

```ts
const outputUsdValue = useMemo(() => {
  if (!zapToken?.expectedAmount || !outputTokenUsdPrice) return '0.00'
  return (parseFloat(zapToken.expectedAmount) * outputTokenUsdPrice).toFixed(2)
}, [zapToken?.expectedAmount, outputTokenUsdPrice])
```

Replace it with raw-aware logic using the shared formatter:

```ts
const outputUsdValue = useMemo(() => {
  if (!zapToken?.expectedAmountRaw || !zapToken?.expectedAmountDecimals || !outputTokenUsdPrice) {
    return '0.00'
  }

  return formatCounterValue(
    formatUnits(zapToken.expectedAmountRaw, zapToken.expectedAmountDecimals),
    outputTokenUsdPrice
  ).replace(/^\$/, '')
}, [zapToken?.expectedAmountRaw, zapToken?.expectedAmountDecimals, outputTokenUsdPrice])
```

If `expectedAmountDecimals` can be `0`, use an explicit `=== undefined` check instead of a truthy check.

**Step 3: Populate the new fields from the withdraw flow**

In `src/components/pages/vaults/components/widget/withdraw/index.tsx`, update the `zapToken` object to pass:

```ts
expectedAmount: effectiveExpectedOut > 0n ? formatWidgetValue(effectiveExpectedOut, outputToken?.decimals ?? 18) : '0',
expectedAmountRaw: effectiveExpectedOut,
expectedAmountDecimals: outputToken?.decimals ?? 18,
```

This preserves the compact token display while making the USD calculation exact.

**Step 4: Run the focused test to verify pass**

Run:
`bunx vitest run src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/pages/vaults/components/widget/InputTokenAmount.tsx src/components/pages/vaults/components/widget/withdraw/index.tsx src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx
git commit -m "fix: use raw withdraw zap quote for usd display"
```

---

### Task 4: Write failing tests for missing USD values in withdraw details

**Objective:** Prove that withdraw zap details currently omit USD values and lock in the desired text.

**Files:**
- Create: `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx`
- Modify later: `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx`

**Step 1: Add a focused test file for withdraw details**

Create a new test file that renders `WithdrawDetails` with a zap route:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WithdrawDetails } from './WithdrawDetails'

describe('WithdrawDetails', () => {
  it('shows usd values for zap swap and receive rows', () => {
    const html = renderToStaticMarkup(
      <WithdrawDetails
        actionLabel="You will redeem"
        requiredShares={15_700000000000000000000n}
        sharesDecimals={18}
        isLoadingQuote={false}
        isQuoteStale={false}
        expectedOut={16_100000n}
        outputDecimals={6}
        outputSymbol="yvUSDC-2"
        showSwapRow
        withdrawAmountSimple="17.9K"
        withdrawAmountBn={17_900000000000000000000n}
        assetDecimals={18}
        assetUsdPrice={1}
        assetSymbol="crvUSD"
        outputUsdPrice={1.11}
        routeType="ENSO"
        onShowDetailsModal={() => {}}
      />
    )

    expect(html).toContain('($17,900')
    expect(html).toContain('($17,871')
  })
})
```

Use exact assertion strings that match the formatter selected in implementation.

**Step 2: Run the focused test to verify failure**

Run:
`bunx vitest run src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx`

Expected: FAIL — current markup contains token quantities only.

**Step 3: Add a non-zap safety test if needed**

If implementation adds conditional rendering branches, add a second test asserting non-zap rows do not suddenly render extra USD text.

**Step 4: Commit**

```bash
git add src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx
git commit -m "test: cover missing withdraw zap detail usd values"
```

---

### Task 5: Add USD values to the withdraw details rows for zap flows

**Objective:** Render the missing USD values in the withdraw details section without changing non-zap behavior.

**Files:**
- Modify: `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx`
- Reference: `src/components/shared/utils/format.ts:653-662`

**Step 1: Compute formatted USD strings inside `WithdrawDetails`**

Add memoized or inline derived strings such as:

```ts
const withdrawUsdDisplay = formatCounterValue(formatUnits(withdrawAmountBn, assetDecimals), assetUsdPrice)
const expectedOutUsdDisplay = formatCounterValue(formatUnits(expectedOut, outputDecimals), outputUsdPrice)
```

Keep the existing price impact math unchanged unless refactoring makes it cleaner to reuse the normalized values.

**Step 2: Update the zap-specific rows to render USD text**

Change the swap row from:

```tsx
<span className="font-semibold">{withdrawAmountSimple}</span>
<span className="font-normal">{assetSymbol}</span>
```

to a rendering pattern like:

```tsx
<span className="font-semibold">{withdrawAmountSimple}</span>{' '}
<span className="font-normal">{assetSymbol}</span>
<span className="font-normal">{` (${withdrawUsdDisplay})`}</span>
```

And change the receive row to append the USD equivalent for zap routes:

```tsx
<span className="font-semibold">{formatWidgetValue(expectedOut, outputDecimals)}</span>{' '}
<span className="font-normal">{outputSymbol}</span>
{routeType === 'ENSO' && <span className="font-normal">{` (${expectedOutUsdDisplay})`}</span>}
```

**Step 3: Preserve existing loading and high-price-impact behavior**

Do not regress:
- the skeleton shown during quote loading
- the red highlight when price impact is high
- the `at least` wording for ENSO routes

**Step 4: Run the focused test to verify pass**

Run:
`bunx vitest run src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx
git commit -m "fix: show usd values in withdraw zap details"
```

---

### Task 6: Verify the end-to-end withdraw zap path and clean up

**Objective:** Ensure the new props and formatting changes integrate cleanly with the existing withdraw widget.

**Files:**
- Verify: `src/components/pages/vaults/components/widget/InputTokenAmount.tsx`
- Verify: `src/components/pages/vaults/components/widget/withdraw/index.tsx`
- Verify: `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx`
- Verify: `src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx`
- Verify: `src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx`

**Step 1: Run the targeted tests together**

Run:
`bunx vitest run src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx`

Expected: PASS

**Step 2: Run type-checking**

Run:
`bun run tslint`

Expected: PASS

**Step 3: Run formatting/linting**

Run:
`bun run lint:fix`

Expected: PASS

**Step 4: Optional manual verification in dev server**

Run:
`bun run dev`

Then verify on a vault with a working ENSO withdraw route that:
- the output token USD line under the zap token shows the correct magnitude
- the inline details rows now include USD values for the zap swap/receive rows
- direct withdraws remain visually unchanged

**Step 5: Commit**

```bash
git add src/components/pages/vaults/components/widget/InputTokenAmount.tsx src/components/pages/vaults/components/widget/withdraw/index.tsx src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.tsx src/components/pages/vaults/components/widget/InputTokenAmount.test.tsx src/components/pages/vaults/components/widget/withdraw/WithdrawDetails.test.tsx
git commit -m "fix: correct withdraw zap usd displays"
```

---

## Notes and pitfalls

- Do not compute USD from `formatWidgetValue(...)` output; that formatter is intentionally human-readable, not machine-parseable.
- Prefer passing raw quote metadata or already formatted USD strings down to presentational components.
- Use explicit `undefined` checks for decimal props; `0` is a valid numeric value even if not expected here.
- Keep non-zap withdraw rendering stable.
- If product review decides the missing-USD screenshot actually refers to `WithdrawDetailsOverlay.tsx`, add a follow-up task to pass the same formatted USD strings into the overlay bullets too. Do not conflate that with the inline `WithdrawDetails` fix unless verified.

## Execution handoff

Plan complete and saved. Ready to execute using subagent-driven-development — I’ll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality) if you want me to implement it next.
