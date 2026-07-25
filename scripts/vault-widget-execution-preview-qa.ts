import { chromium, type Page } from 'playwright'

type ExecutionPreview =
  | 'wallet'
  | 'chain-switch'
  | 'reset-approval'
  | 'approval'
  | 'permit'
  | 'refresh'
  | 'safe-confirm'
  | 'pending'
  | 'safe-pending'
  | 'bridge'
  | 'success'
  | 'error'

type PreviewCase = {
  description: string
  dismissible: boolean
  id: string
  preview: ExecutionPreview
  state: 'deposit' | 'withdraw' | 'migrate' | 'rewards'
  status: 'confirming' | 'pending' | 'submitted' | 'success' | 'error'
  title: string
  variant?: 'locked' | 'unlocked'
  vault: 'ybold' | 'yvusd' | 'v2-migration' | 'v3-staking' | 'juiced-rewards' | 'merkl-rewards'
  viewport: 'desktop' | 'mobile'
}

type PreviewResult = {
  constrained: boolean
  id: string
  reopened?: boolean
  title: string
}

const BASE_URL = process.env.VAULT_WIDGET_QA_URL ?? 'http://127.0.0.1:4246/dev/vault-widget'
const CASE_FILTER = process.env.VAULT_WIDGET_QA_CASE?.trim()
const PREVIEWS = [
  {
    description: 'Deposit assets (1/2)',
    dismissible: false,
    preview: 'wallet',
    state: 'deposit',
    status: 'confirming',
    title: 'Confirm in your wallet',
    vault: 'ybold'
  },
  {
    description: 'Switch to destination chain (1/5)',
    dismissible: false,
    preview: 'chain-switch',
    state: 'rewards',
    status: 'confirming',
    title: 'Confirm in your wallet',
    vault: 'merkl-rewards'
  },
  {
    description: 'Reset token approval (2/5)',
    dismissible: false,
    preview: 'reset-approval',
    state: 'deposit',
    status: 'confirming',
    title: 'Confirm in your wallet',
    vault: 'ybold'
  },
  {
    description: 'Approve token (3/5)',
    dismissible: false,
    preview: 'approval',
    state: 'deposit',
    status: 'confirming',
    title: 'Confirm in your wallet',
    vault: 'v3-staking'
  },
  {
    description: 'Sign migration permit (2/4)',
    dismissible: false,
    preview: 'permit',
    state: 'migrate',
    status: 'confirming',
    title: 'Confirm in your wallet',
    vault: 'v2-migration'
  },
  {
    description: 'Updating balances…',
    dismissible: false,
    preview: 'refresh',
    state: 'withdraw',
    status: 'confirming',
    title: 'Your transaction was confirmed.',
    variant: 'locked',
    vault: 'yvusd'
  },
  {
    description: 'Propose deposit (1/1)',
    dismissible: false,
    preview: 'safe-confirm',
    state: 'deposit',
    status: 'confirming',
    title: 'Confirm the proposal in Safe',
    vault: 'ybold'
  },
  {
    description: 'Waiting for confirmation. Deposit assets (1/2)',
    dismissible: false,
    preview: 'pending',
    state: 'deposit',
    status: 'pending',
    title: 'Transaction pending',
    vault: 'ybold'
  },
  {
    description: 'Execution may happen separately after the required Safe confirmations are collected.',
    dismissible: true,
    preview: 'safe-pending',
    state: 'deposit',
    status: 'pending',
    title: 'Transaction submitted',
    vault: 'ybold'
  },
  {
    description: 'Waiting for destination-chain completion.',
    dismissible: true,
    preview: 'bridge',
    state: 'withdraw',
    status: 'submitted',
    title: 'Cross-chain transaction submitted',
    vault: 'ybold'
  },
  {
    description: 'Your transaction was confirmed.',
    dismissible: true,
    preview: 'success',
    state: 'deposit',
    status: 'success',
    title: 'Transaction complete',
    vault: 'v3-staking'
  },
  {
    description: 'Transaction reverted during simulation.',
    dismissible: true,
    preview: 'error',
    state: 'rewards',
    status: 'error',
    title: 'Transaction failed',
    vault: 'juiced-rewards'
  }
] as const
const CASES: readonly PreviewCase[] = (['desktop', 'mobile'] as const).flatMap((viewport) =>
  PREVIEWS.map((preview) => ({
    ...preview,
    id: `${preview.preview}-${viewport}`,
    viewport
  }))
)
const ACTIVE_CASES = CASE_FILTER ? CASES.filter(({ id }) => id === CASE_FILTER) : CASES

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function createCaseUrl(qaCase: PreviewCase): string {
  const url = new URL(BASE_URL)
  url.searchParams.set('execution', qaCase.preview)
  url.searchParams.set('state', qaCase.state)
  url.searchParams.set('vault', qaCase.vault)
  url.searchParams.set('viewport', qaCase.viewport)
  if (qaCase.variant) url.searchParams.set('variant', qaCase.variant)
  return url.toString()
}

async function verifyCase(page: Page, qaCase: PreviewCase): Promise<PreviewResult> {
  await page.goto(createCaseUrl(qaCase), { waitUntil: 'domcontentloaded' })
  const previewRoot = page.locator(`[data-execution-preview="${qaCase.preview}"]`)
  const dialog = previewRoot.getByRole('dialog', { name: qaCase.title })
  await dialog.waitFor({ state: 'visible' })

  invariant((await dialog.getAttribute('data-status')) === qaCase.status, `${qaCase.id}: incorrect execution status`)
  invariant(
    (await dialog.locator('p').textContent()) === qaCase.description,
    `${qaCase.id}: incorrect execution description`
  )
  const [rootBox, dialogBox] = await Promise.all([previewRoot.boundingBox(), dialog.boundingBox()])
  invariant(rootBox && dialogBox, `${qaCase.id}: preview geometry is unavailable`)
  const constrained =
    Math.abs(rootBox.x - dialogBox.x) <= 1 &&
    Math.abs(rootBox.y - dialogBox.y) <= 1 &&
    Math.abs(rootBox.width - dialogBox.width) <= 1 &&
    Math.abs(rootBox.height - dialogBox.height) <= 1
  invariant(constrained, `${qaCase.id}: transaction overlay escaped the widget bounds`)
  const backgroundSurface = previewRoot.locator(':scope > :not(.yv-widget__transaction-overlay)')
  invariant((await backgroundSurface.count()) === 1, `${qaCase.id}: package background surface is ambiguous`)
  const isolatedBackground = previewRoot.locator(
    ':scope > [aria-hidden="true"][inert]:not(.yv-widget__transaction-overlay)'
  )
  await isolatedBackground.waitFor({ state: 'attached' })
  invariant(
    (await backgroundSurface.getAttribute('aria-hidden')) === 'true',
    `${qaCase.id}: background widget remained visible to assistive technology`
  )
  invariant(
    (await backgroundSurface.getAttribute('inert')) !== null,
    `${qaCase.id}: background widget remained interactive`
  )

  const closeButton = dialog.getByRole('button', { name: 'Close transaction status' })
  if (!qaCase.dismissible) {
    invariant((await closeButton.count()) === 0, `${qaCase.id}: blocking wallet state was dismissible`)
    return { constrained, id: qaCase.id, title: qaCase.title }
  }

  await closeButton.click()
  await dialog.waitFor({ state: 'hidden' })
  if (qaCase.preview === 'safe-pending' || qaCase.preview === 'bridge') {
    const resumeButton = previewRoot.getByRole('button', {
      name: `View transaction status: ${qaCase.title}`
    })
    await resumeButton.click()
    await dialog.waitFor({ state: 'visible' })
    return { constrained, id: qaCase.id, reopened: true, title: qaCase.title }
  }

  invariant(
    (await page.getByLabel('Execution preview').inputValue()) === 'none',
    `${qaCase.id}: terminal overlay did not reset the preview`
  )
  return { constrained, id: qaCase.id, title: qaCase.title }
}

async function main(): Promise<void> {
  invariant(ACTIVE_CASES.length > 0, `No execution preview case matches ${CASE_FILTER}`)
  const browser = await chromium.launch({ headless: true })
  const tenderlyRequests: string[] = []
  const results: PreviewResult[] = []
  const failures: Array<{ error: string; id: string }> = []

  await ACTIVE_CASES.reduce<Promise<void>>(async (previous, qaCase) => {
    await previous
    const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } })
    await context.route(/tenderly/i, async (route) => {
      tenderlyRequests.push(route.request().url())
      await route.abort('blockedbyclient')
    })
    const page = await context.newPage()
    page.setDefaultTimeout(60_000)
    try {
      results.push(await verifyCase(page, qaCase))
    } catch (value) {
      failures.push({
        error: value instanceof Error ? value.message : String(value),
        id: qaCase.id
      })
    } finally {
      await context.close()
    }
  }, Promise.resolve())

  await browser.close()
  invariant(tenderlyRequests.length === 0, 'Execution preview QA attempted to contact Tenderly')
  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        cases: ACTIVE_CASES.length,
        failures,
        passed: results.length,
        results
      },
      null,
      2
    )
  )
  invariant(failures.length === 0, `${failures.length} execution preview cases failed`)
}

await main()
