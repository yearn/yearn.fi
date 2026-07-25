import { chromium, type Frame, type Page } from 'playwright'

type ParityCase = {
  account?: `0x${string}`
  expectedRewardSymbol?: string
  id: string
  state: 'deposit' | 'info' | 'migrate' | 'rewards' | 'settings' | 'withdraw'
  variant?: 'locked' | 'unlocked'
  vault: 'juiced-rewards' | 'merkl-rewards' | 'v2-migration' | 'v2-ycrv' | 'v3-staking' | 'ybold' | 'yvbtc' | 'yvusd'
  viewport: 'desktop' | 'mobile'
}

type ParityResult = {
  id: string
  legacyStateVerified: boolean
  packageStateVerified: boolean
  rewardAmount?: string
}

const BASE_URL = process.env.VAULT_WIDGET_QA_URL ?? 'http://127.0.0.1:4246/dev/vault-widget'
const CASE_FILTER = process.env.VAULT_WIDGET_QA_CASE?.trim()
const CONCURRENCY = 1
const JUICED_REWARD_ACCOUNT = '0x719b3d3bbb9207e301ee9abf7574a4a756e0c2e3'
const MERKL_REWARD_ACCOUNT = '0xf46e183e8b010cfdebe57a50064149e65504c2bf'
const VEYFI_REWARD_ACCOUNT = '0x8ee796309494a10b4170f8912613ee78c75a3430'
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
  },
  {
    account: VEYFI_REWARD_ACCOUNT,
    expectedRewardSymbol: 'dYFI',
    id: 'veyfi-rewards-desktop',
    state: 'rewards',
    vault: 'v3-staking',
    viewport: 'desktop'
  },
  {
    account: MERKL_REWARD_ACCOUNT,
    expectedRewardSymbol: 'KAT',
    id: 'merkl-rewards-desktop',
    state: 'rewards',
    vault: 'merkl-rewards',
    viewport: 'desktop'
  }
]
const ACTIVE_CASES = CASE_FILTER ? CASES.filter(({ id }) => id === CASE_FILTER) : CASES

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

async function waitForPackage(page: Page, qaCase: ParityCase, canRetry = true): Promise<boolean> {
  const widget = page.locator(`.yv-widget[data-viewport="${qaCase.viewport}"]:visible`)
  try {
    await widget.waitFor({ state: 'visible', timeout: canRetry ? 30_000 : 60_000 })
  } catch (error) {
    if (!canRetry) throw error
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
    await waitForConnectedHarness(page)
    return waitForPackage(page, qaCase, false)
  }
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('.yv-widget')).some((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && !element.textContent?.includes('Loading vault')
    })
  })
  invariant((await widget.count()) === 1, `${qaCase.id}: expected exactly one visible package widget`)
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
    await rewardRow.getByRole('button', { exact: true, name: 'Claim' }).click({ trial: true })
  }
  return true
}

async function waitForLegacyFrame(page: Page, qaCase: ParityCase, walletLabel: string): Promise<Frame> {
  const iframe = page.locator('iframe[title^="Legacy "]')
  await iframe.waitFor({ state: 'visible' })
  const iframeHandle = await iframe.elementHandle()
  const frame = await iframeHandle?.contentFrame()
  invariant(frame, `${qaCase.id}: legacy frame is unavailable`)
  await frame.waitForURL((url) => url.searchParams.get('vaultWidget') === 'legacy')
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
    const claimButton = rewardRow.getByRole('button', { exact: true, name: 'Claim' })
    const readiness = await frame.waitForFunction((symbol) => {
      const rewardRow = Array.from(document.querySelectorAll<HTMLElement>('div.flex.flex-col.gap-3.py-3')).find(
        (element) => element.textContent?.includes(symbol)
      )
      const claimButton = Array.from(rewardRow?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
        (button) => button.textContent?.trim() === 'Claim'
      )
      if (!claimButton) return false
      if (!claimButton.disabled) return 'ready'

      const switchChainButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Switch Chain'
      )
      if (!switchChainButton) return false
      const rect = switchChainButton.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 ? 'switch' : false
    }, qaCase.expectedRewardSymbol)
    if ((await readiness.jsonValue()) === 'switch') {
      const switchChainButton = frame.getByRole('button', { exact: true, name: 'Switch Chain' })
      await switchChainButton.click()
    }
    await claimButton.click({ trial: true })
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
  let rewardAmount: string | undefined
  if (qaCase.state === 'rewards') {
    invariant(qaCase.expectedRewardSymbol, `${qaCase.id}: expected reward symbol is not configured`)
    const packageRow = page.locator('.yv-widget__reward-row').filter({ hasText: qaCase.expectedRewardSymbol })
    const legacyRow = frame.locator('div.flex.flex-col.gap-3.py-3').filter({ hasText: qaCase.expectedRewardSymbol })
    const packageAmount = (await packageRow.locator('.yv-widget__reward-amount > strong').innerText()).trim()
    const legacyAmount = (await legacyRow.locator('span.text-base.font-bold').first().innerText()).trim()
    invariant(
      packageAmount === legacyAmount,
      `${qaCase.id}: reward amount differs (package ${packageAmount}, legacy ${legacyAmount})`
    )
    rewardAmount = packageAmount
  }

  return {
    id: qaCase.id,
    legacyStateVerified,
    packageStateVerified,
    rewardAmount
  }
}

async function main(): Promise<void> {
  invariant(ACTIVE_CASES.length > 0, `Unknown vault widget parity case: ${CASE_FILTER}`)
  const browser = await chromium.launch({ headless: true })
  const results: ParityResult[] = []
  const failures: { error: string; id: string }[] = []
  let caseIndex = 0

  try {
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (caseIndex < ACTIVE_CASES.length) {
          const qaCase = ACTIVE_CASES[caseIndex++]
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
        cases: ACTIVE_CASES.length,
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
