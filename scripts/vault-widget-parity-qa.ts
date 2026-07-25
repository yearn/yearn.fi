import { chromium, type Frame, type Page } from 'playwright'

type ParityCase = {
  account?: `0x${string}`
  expectedRewardSymbol?: string
  id: string
  state: 'deposit' | 'info' | 'migrate' | 'rewards' | 'settings' | 'withdraw'
  variant?: 'locked' | 'unlocked'
  vault: 'juiced-rewards' | 'v2-migration' | 'v2-ycrv' | 'v3-staking' | 'ybold' | 'yvbtc' | 'yvusd'
  viewport: 'desktop' | 'mobile'
}

type ParityResult = {
  id: string
  legacyStateVerified: boolean
  packageStateVerified: boolean
}

const BASE_URL = process.env.VAULT_WIDGET_QA_URL ?? 'http://127.0.0.1:4246/dev/vault-widget'
const CONCURRENCY = 1
const JUICED_REWARD_ACCOUNT = '0x719b3d3bbb9207e301ee9abf7574a4a756e0c2e3'
const V2_USDC_HOLDER = '0xC4080c19DE69c2362d01B20F071D4046364A0226'
const STATE_LABELS: Record<ParityCase['state'], string> = {
  deposit: 'Deposit',
  info: 'My Info',
  migrate: 'Migrate',
  rewards: 'Rewards',
  settings: 'Settings',
  withdraw: 'Withdraw'
}

const CASES: readonly ParityCase[] = [
  { id: 'ybold-deposit-desktop', state: 'deposit', vault: 'ybold', viewport: 'desktop' },
  { id: 'ybold-withdraw-desktop', state: 'withdraw', vault: 'ybold', viewport: 'desktop' },
  { id: 'ybold-info-desktop', state: 'info', vault: 'ybold', viewport: 'desktop' },
  { id: 'ybold-settings-desktop', state: 'settings', vault: 'ybold', viewport: 'desktop' },
  { id: 'ybold-deposit-mobile', state: 'deposit', vault: 'ybold', viewport: 'mobile' },
  { id: 'ybold-withdraw-mobile', state: 'withdraw', vault: 'ybold', viewport: 'mobile' },
  { id: 'yvbtc-deposit-desktop', state: 'deposit', vault: 'yvbtc', viewport: 'desktop' },
  { id: 'yvbtc-info-desktop', state: 'info', vault: 'yvbtc', viewport: 'desktop' },
  { id: 'yvbtc-withdraw-mobile', state: 'withdraw', vault: 'yvbtc', viewport: 'mobile' },
  { id: 'yvusd-locked-withdraw-desktop', state: 'withdraw', variant: 'locked', vault: 'yvusd', viewport: 'desktop' },
  {
    id: 'yvusd-unlocked-deposit-desktop',
    state: 'deposit',
    variant: 'unlocked',
    vault: 'yvusd',
    viewport: 'desktop'
  },
  {
    id: 'yvusd-unlocked-withdraw-mobile',
    state: 'withdraw',
    variant: 'unlocked',
    vault: 'yvusd',
    viewport: 'mobile'
  },
  { id: 'v2-ycrv-withdraw-desktop', state: 'withdraw', vault: 'v2-ycrv', viewport: 'desktop' },
  {
    account: V2_USDC_HOLDER,
    id: 'v2-migration-desktop',
    state: 'migrate',
    vault: 'v2-migration',
    viewport: 'desktop'
  },
  { id: 'v3-staking-deposit-desktop', state: 'deposit', vault: 'v3-staking', viewport: 'desktop' },
  {
    account: JUICED_REWARD_ACCOUNT,
    expectedRewardSymbol: 'AJNA',
    id: 'juiced-rewards-desktop',
    state: 'rewards',
    vault: 'juiced-rewards',
    viewport: 'desktop'
  }
]

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function createCaseUrl(qaCase: ParityCase): string {
  const url = new URL(BASE_URL)
  url.searchParams.set('agentWallet', 'true')
  if (qaCase.account) url.searchParams.set('agentWalletAddress', qaCase.account)
  url.searchParams.set('state', qaCase.state)
  url.searchParams.set('vault', qaCase.vault)
  url.searchParams.set('viewport', qaCase.viewport)
  if (qaCase.variant) url.searchParams.set('variant', qaCase.variant)
  return url.toString()
}

async function waitForConnectedHarness(page: Page): Promise<string> {
  const walletButton = page.locator('fieldset').filter({ hasText: 'Wallet session' }).locator('button')
  await walletButton.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const fieldset = Array.from(document.querySelectorAll('fieldset')).find((candidate) =>
      candidate.textContent?.includes('Wallet session')
    )
    const label = fieldset?.querySelector('button')?.textContent?.trim()
    return !!label && label !== 'Connect both surfaces'
  })
  const label = (await walletButton.innerText()).trim()
  invariant(/^0x[0-9a-f]{4}.+[0-9a-f]{4}$/i.test(label), `Unexpected connected wallet label: ${label}`)
  return label
}

async function waitForPackage(page: Page, qaCase: ParityCase): Promise<boolean> {
  const widget = page.locator('.yv-widget')
  await widget.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const element = document.querySelector('.yv-widget')
    return !!element && !element.textContent?.includes('Loading vault')
  })
  await page.waitForFunction(
    (viewport) => document.querySelector('.yv-widget')?.getAttribute('data-viewport') === viewport,
    qaCase.viewport
  )

  invariant((await widget.count()) === 1, `${qaCase.id}: expected exactly one package widget`)
  const text = await widget.innerText()
  invariant(!text.includes('Unable to load'), `${qaCase.id}: package rendered a loading error`)

  if (qaCase.state === 'settings') {
    await widget.locator('.yv-widget__settings').waitFor({ state: 'visible' })
    return true
  }

  await page.waitForFunction(
    (selectedLabel) =>
      document.querySelector('.yv-widget .yv-widget__tab[aria-selected="true"]')?.textContent?.trim() === selectedLabel,
    STATE_LABELS[qaCase.state]
  )
  if (qaCase.state === 'rewards') {
    invariant(qaCase.expectedRewardSymbol, `${qaCase.id}: expected reward symbol is not configured`)
    await widget.locator('.yv-widget__workflow-balance').filter({ hasText: 'Claimable Rewards' }).waitFor({
      state: 'visible'
    })
    const rewardRow = widget.locator('.yv-widget__reward-row').filter({ hasText: qaCase.expectedRewardSymbol })
    await rewardRow.waitFor({ state: 'visible' })
    invariant(
      await rewardRow.getByRole('button', { exact: true, name: 'Claim' }).isEnabled(),
      `${qaCase.id}: package reward is not claimable`
    )
  }
  return true
}

async function waitForLegacyFrame(page: Page, qaCase: ParityCase, walletLabel: string): Promise<Frame> {
  const iframe = page.locator('iframe[title^="Legacy "]')
  await iframe.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLIFrameElement>('iframe[title^="Legacy "]')
    return element?.contentDocument?.readyState === 'complete'
  })
  const frame = page.frames().find((candidate) => candidate.url().includes('vaultWidget=legacy'))
  invariant(frame, `${qaCase.id}: legacy frame is unavailable`)
  await frame.locator('body').waitFor({ state: 'visible' })
  await page.waitForTimeout(1_500)

  invariant((await frame.locator('.yv-widget').count()) === 0, `${qaCase.id}: legacy frame rendered the package`)
  await frame.waitForFunction(
    ({ prefix, suffix, viewport }) => {
      const text = document.body?.innerText ?? ''
      if (viewport === 'desktop') return text.includes(prefix) && text.includes(suffix)

      const visibleButtonLabels = Array.from(document.querySelectorAll('button'))
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '')
      const hasTransactionDrawer = visibleButtonLabels.includes('deposit') || visibleButtonLabels.includes('withdraw')
      const asksToConnect = visibleButtonLabels.some((label) => label.includes('connect wallet'))
      return hasTransactionDrawer && !asksToConnect
    },
    { prefix: walletLabel.slice(0, 6), suffix: walletLabel.slice(-4), viewport: qaCase.viewport }
  )
  return frame
}

async function verifyLegacyState(frame: Frame, qaCase: ParityCase): Promise<boolean> {
  if (qaCase.state === 'settings') {
    await frame
      .locator('h1, h2, h3, h4, h5, h6')
      .filter({ hasText: /^Transaction settings$/i })
      .waitFor({ state: 'visible' })
    return true
  }

  if (qaCase.state === 'rewards') {
    invariant(qaCase.expectedRewardSymbol, `${qaCase.id}: expected reward symbol is not configured`)
    await frame.getByText('Claimable Rewards', { exact: true }).waitFor({ state: 'visible' })
    const rewardRow = frame.locator('div.flex.flex-col.gap-3.py-3').filter({ hasText: qaCase.expectedRewardSymbol })
    await rewardRow.waitFor({ state: 'visible' })
    invariant(
      await rewardRow.getByRole('button', { exact: true, name: 'Claim' }).isEnabled(),
      `${qaCase.id}: legacy reward is not claimable`
    )
    return true
  }

  const modeLabel = STATE_LABELS[qaCase.state].toLowerCase()
  await frame.waitForFunction(
    (input) => {
      const elements = Array.from(document.querySelectorAll('button, [role="tab"]'))
      const candidates = elements.filter((element) => {
        const label = element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase()
        if (label !== input.modeLabel || !(element instanceof HTMLElement)) return false
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      const scoped =
        input.viewport === 'desktop'
          ? candidates.filter((element) => {
              const rect = element.getBoundingClientRect()
              return rect.left > 916 && rect.top > 190
            })
          : candidates.filter(
              (element) => element.getAttribute('role') === 'tab' || element.classList.contains('flex-1')
            )
      return (
        scoped.some(
          (element) =>
            element.getAttribute('aria-selected') === 'true' ||
            element.getAttribute('aria-pressed') === 'true' ||
            (element.classList.contains('bg-surface') && element.classList.contains('text-text-primary'))
        ) ||
        (input.viewport === 'mobile' &&
          candidates.some((element) => element.classList.contains('yearn--button--nextgen')))
      )
    },
    { modeLabel, viewport: qaCase.viewport }
  )
  return true
}

async function runCase(page: Page, qaCase: ParityCase): Promise<ParityResult> {
  page.setDefaultTimeout(60_000)
  await page.goto(createCaseUrl(qaCase), { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const walletLabel = await waitForConnectedHarness(page)
  const packageStateVerified = await waitForPackage(page, qaCase)
  const frame = await waitForLegacyFrame(page, qaCase, walletLabel)
  const legacyStateVerified = await verifyLegacyState(frame, qaCase)
  invariant(packageStateVerified, `${qaCase.id}: package did not select ${qaCase.state}`)
  invariant(legacyStateVerified, `${qaCase.id}: legacy frame did not select ${qaCase.state}`)

  return {
    id: qaCase.id,
    legacyStateVerified,
    packageStateVerified
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const results: ParityResult[] = []
  const failures: { error: string; id: string }[] = []
  let caseIndex = 0

  try {
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (caseIndex < CASES.length) {
          const qaCase = CASES[caseIndex++]
          if (!qaCase) return
          const page = await browser.newPage({ viewport: { height: 1_000, width: 1_440 } })
          try {
            results.push(await runCase(page, qaCase))
          } catch (error) {
            failures.push({
              error: error instanceof Error ? error.message : String(error),
              id: qaCase.id
            })
          } finally {
            await page.close()
          }
        }
      })
    )
  } finally {
    await browser.close()
  }

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        cases: CASES.length,
        failures,
        passed: results.length,
        results
      },
      null,
      2
    )
  )
  invariant(failures.length === 0, `${failures.length} vault widget parity cases failed`)
}

await main()
