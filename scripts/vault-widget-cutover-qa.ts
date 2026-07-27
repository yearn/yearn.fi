import { VAULT_WIDGET_VERSION } from '@yearn/vault-widget'
import { chromium, type Locator, type Page } from 'playwright'

type CutoverResult = {
  id: string
  mode: string
  switcher: 'built-in' | 'external'
}

const BASE_URL = process.env.VAULT_WIDGET_QA_URL ?? 'http://127.0.0.1:4246'
const YBOLD_VAULT = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'
const V2_MIGRATION_VAULT = '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE'
const V2_USDC_HOLDER = '0xC4080c19DE69c2362d01B20F071D4046364A0226'
const JUICED_REWARD_VAULT = '0xe24BA27551aBE96Ca401D39761cA2319Ea14e3CB'
const JUICED_REWARD_ACCOUNT = '0x719b3d3bbb9207e301ee9abf7574a4a756e0c2e3'
const SETTINGS_VERSION = `@yearn/vault-widget v${VAULT_WIDGET_VERSION}`

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function vaultUrl(chainId: number, vaultAddress: string, account?: string): string {
  const url = new URL(`/vaults/${chainId}/${vaultAddress}`, BASE_URL)
  if (account) {
    url.searchParams.set('agentWallet', 'true')
    url.searchParams.set('agentWalletAddress', account)
  }
  return url.toString()
}

async function waitForCompleteWidget(page: Page, switcher: CutoverResult['switcher']): Promise<Locator> {
  const widget = page.locator('.yv-widget:visible')
  await widget.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('.yv-widget')).some((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && !element.textContent?.includes('Loading vault')
    })
  })
  invariant((await widget.count()) === 1, 'Expected exactly one visible package widget on the cutover route')
  invariant((await widget.getAttribute('data-switcher')) === switcher, `Expected the ${switcher} package switcher`)
  const hostSwitcher = page.locator('[data-tour="vault-detail-widget-tabs"]:visible')
  if (switcher === 'external') {
    invariant((await hostSwitcher.count()) === 1, 'The yearn.fi header switcher is not visible')
    invariant(
      (await widget.getByRole('tablist', { name: 'Vault action' }).count()) === 0,
      'Package switcher remained visible'
    )
    invariant((await widget.locator('.yv-widget__summary').count()) === 0, 'Package summary remained visible')
  } else {
    invariant((await hostSwitcher.count()) === 0, 'The host switcher remained visible beside the built-in switcher')
    invariant(
      (await widget.getByRole('tablist', { name: 'Vault action' }).count()) === 1,
      'Package switcher is missing'
    )
  }
  return widget
}

async function verifyDesktopSwitcherLayout(page: Page, widget: Locator): Promise<void> {
  const hostSwitcher = page.locator('[data-tour="vault-detail-widget-tabs"]:visible')
  const holdings = page.locator('[data-tour="vault-detail-user-holdings"]:visible')
  await holdings.waitFor({ state: 'visible' })
  const [switcherBox, widgetBox] = await Promise.all([hostSwitcher.boundingBox(), widget.boundingBox()])
  invariant(switcherBox && widgetBox, 'Unable to measure the desktop switcher and widget')
  invariant(Math.abs(switcherBox.x - widgetBox.x) <= 2, 'Header switcher and widget are not horizontally aligned')
  invariant(Math.abs(switcherBox.width - widgetBox.width) <= 2, 'Header switcher and widget widths do not match')
  invariant(widgetBox.y >= switcherBox.y + switcherBox.height, 'Widget overlaps the header switcher')
}

async function verifySettingsVersion(widget: Locator): Promise<void> {
  const version = widget.locator('.yv-widget__settings-version')
  await version.waitFor({ state: 'visible' })
  invariant((await version.textContent())?.trim() === SETTINGS_VERSION, 'Package settings version is incorrect')
}

async function verifyDesktopYBold(page: Page): Promise<CutoverResult> {
  await page.goto(vaultUrl(1, YBOLD_VAULT), { waitUntil: 'domcontentloaded' })
  const widget = await waitForCompleteWidget(page, 'external')
  await verifyDesktopSwitcherLayout(page, widget)
  await page.locator('[data-tour="vault-detail-user-holdings"]').filter({ hasText: 'Your Deposits' }).waitFor({
    state: 'visible'
  })
  await widget.locator('.yv-widget__settings-button--action').click()
  await widget.locator('.yv-widget__settings').waitFor({ state: 'visible' })
  await verifySettingsVersion(widget)
  await widget.getByRole('button', { exact: true, name: 'Close settings' }).click()
  await widget.locator('.yv-widget__settings').waitFor({ state: 'hidden' })
  await page
    .locator('[data-tour="vault-detail-widget-tabs"]')
    .getByRole('tab', { exact: true, name: 'My Info' })
    .click()
  invariant(
    (await page
      .locator('[data-tour="vault-detail-widget-tabs"]')
      .getByRole('tab', { exact: true, name: 'My Info' })
      .getAttribute('aria-selected')) === 'true',
    'Host My Info tab did not become active'
  )
  await widget.locator('.yv-widget__wallet').waitFor({ state: 'visible' })
  return { id: 'ybold-desktop-complete-surface', mode: 'info/settings', switcher: 'external' }
}

async function verifyDesktopMigration(page: Page): Promise<CutoverResult> {
  await page.goto(vaultUrl(1, V2_MIGRATION_VAULT, V2_USDC_HOLDER), { waitUntil: 'domcontentloaded' })
  const widget = await waitForCompleteWidget(page, 'external')
  await verifyDesktopSwitcherLayout(page, widget)
  const migrateTab = page
    .locator('[data-tour="vault-detail-widget-tabs"]')
    .getByRole('tab', { exact: true, name: 'Migrate' })
  await migrateTab.waitFor({ state: 'visible' })
  await migrateTab.click()
  invariant((await migrateTab.getAttribute('aria-selected')) === 'true', 'Package migration tab did not become active')
  await widget.locator('.yv-widget__workflow-destination').waitFor({ state: 'visible' })
  return { id: 'v2-migration-desktop-complete-surface', mode: 'migrate', switcher: 'external' }
}

async function verifyDesktopRewards(page: Page): Promise<CutoverResult> {
  await page.goto(vaultUrl(1, JUICED_REWARD_VAULT, JUICED_REWARD_ACCOUNT), { waitUntil: 'domcontentloaded' })
  const widget = await waitForCompleteWidget(page, 'external')
  await verifyDesktopSwitcherLayout(page, widget)
  const rewardsTab = page
    .locator('[data-tour="vault-detail-widget-tabs"]')
    .getByRole('tab', { exact: true, name: 'Rewards' })
  await rewardsTab.waitFor({ state: 'visible' })
  await rewardsTab.click()
  invariant((await rewardsTab.getAttribute('aria-selected')) === 'true', 'Package rewards tab did not become active')
  await widget.locator('.yv-widget__workflow-balance').filter({ hasText: 'Claimable Rewards' }).waitFor({
    state: 'visible'
  })
  return { id: 'rewards-desktop-complete-surface', mode: 'rewards', switcher: 'external' }
}

async function verifyMobileYBold(page: Page): Promise<CutoverResult> {
  await page.goto(vaultUrl(1, YBOLD_VAULT), { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { exact: true, name: 'Deposit' }).click()
  const drawer = page.getByRole('dialog')
  const widget = await waitForCompleteWidget(page, 'built-in')
  await widget.locator('.yv-widget__summary-mobile').filter({ hasText: 'Yearn BOLD' }).waitFor({ state: 'visible' })
  invariant(
    (await drawer.locator('button[aria-label="Close drawer"]').count()) === 0,
    'Host drawer header remained visible'
  )
  await widget.getByRole('button', { exact: true, name: 'Transaction Settings' }).click()
  await verifySettingsVersion(widget)
  await widget.getByRole('button', { exact: true, name: 'Close settings' }).click()
  await widget.getByRole('tab', { exact: true, name: 'My Info' }).click()
  invariant(
    (await widget.getByRole('tab', { exact: true, name: 'My Info' }).getAttribute('aria-selected')) === 'true',
    'Mobile package My Info tab did not become active'
  )
  await widget.getByRole('button', { exact: true, name: 'Close' }).click()
  await widget.waitFor({ state: 'hidden' })
  return { id: 'ybold-mobile-complete-surface', mode: 'settings/info/close', switcher: 'built-in' }
}

async function verifyStandaloneSwitcher(page: Page): Promise<CutoverResult> {
  const url = new URL('/dev/vault-widget', BASE_URL)
  url.searchParams.set('vault', 'ybold')
  url.searchParams.set('state', 'deposit')
  url.searchParams.set('viewport', 'desktop')
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
  const widget = await waitForCompleteWidget(page, 'built-in')
  await widget.getByRole('tab', { exact: true, name: 'Withdraw' }).click()
  invariant(
    (await widget.getByRole('tab', { exact: true, name: 'Withdraw' }).getAttribute('aria-selected')) === 'true',
    'Standalone package switcher did not control the widget'
  )
  return { id: 'standalone-desktop-switcher', mode: 'deposit/withdraw', switcher: 'built-in' }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { height: 1_000, width: 1_440 } })
  const tenderlyRequests: string[] = []
  await context.route(/tenderly/i, async (route) => {
    tenderlyRequests.push(route.request().url())
    await route.abort('blockedbyclient')
  })
  const results: CutoverResult[] = []

  try {
    const desktopPage = await context.newPage()
    desktopPage.setDefaultTimeout(60_000)
    results.push(await verifyDesktopYBold(desktopPage))
    results.push(await verifyDesktopMigration(desktopPage))
    results.push(await verifyDesktopRewards(desktopPage))
    results.push(await verifyStandaloneSwitcher(desktopPage))
    await desktopPage.close()

    const mobilePage = await context.newPage()
    mobilePage.setDefaultTimeout(60_000)
    await mobilePage.setViewportSize({ height: 844, width: 390 })
    results.push(await verifyMobileYBold(mobilePage))
    await mobilePage.close()
  } finally {
    await context.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
  }

  invariant(tenderlyRequests.length === 0, 'Cutover QA attempted to contact Tenderly')
  console.log(JSON.stringify({ baseUrl: BASE_URL, passed: results.length, results }, null, 2))
}

await main()
