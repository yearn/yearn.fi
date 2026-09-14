import { getYearnRainbowTheme, getYearnWallets, WALLETCONNECT_QR_WALLET_ID } from '@yearn/wallet-ui/rainbowkit'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

it('keeps the generic QR choice on desktop and curated app choices on phones and tablets', () => {
  const qrWallet = getYearnWallets()[0].wallets[1]({ projectId: 'test', appName: 'Yearn' })
  expect(qrWallet.id).toBe(WALLETCONNECT_QR_WALLET_ID)
  expect(qrWallet.qrCode?.getUri('wc:test')).toBe('wc:test')
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })
  expect(qrWallet.hidden?.()).toBe(false)
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone)' })
  expect(qrWallet.hidden?.()).toBe(true)
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Android)' })
  expect(qrWallet.hidden?.()).toBe(true)
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })
  expect(qrWallet.hidden?.()).toBe(true)
})

it('keeps the curated wallet list and separate Safe transport/iframe choices using public definitions', () => {
  const wallets = getYearnWallets()
    .find(({ groupName }) => groupName === 'More wallets')
    ?.wallets.map((wallet) => wallet({ projectId: 'test', appName: 'Yearn' }))
  expect(wallets?.map(({ name }) => name)).toEqual([
    'Trust Wallet',
    'MetaMask',
    'Binance Wallet',
    'SafePal Wallet',
    'TokenPocket',
    'Fireblocks',
    'IronWallet',
    'Bitget Wallet',
    'OKX Wallet',
    'Ledger',
    'Safe'
  ])
  const customChoices = wallets?.filter(({ id }) => ['fireblocks', 'ironWallet', 'safeWalletConnect'].includes(id))
  customChoices?.forEach((wallet) => {
    expect(wallet.iconUrl).toMatch(/^data:image\//)
    expect(wallet.qrCode?.getUri('wc:test@2?relay-protocol=irn&symKey=secret')).toBe(
      'wc:test@2?relay-protocol=irn&symKey=secret'
    )
    expect(wallet.mobile?.getUri?.('wc:test@2?relay-protocol=irn&symKey=secret')).toContain(
      'uri=wc%3Atest%402%3Frelay-protocol%3Dirn%26symKey%3Dsecret'
    )
  })
  expect(
    getYearnWallets()
      .find(({ groupName }) => groupName === 'Safe Apps')
      ?.wallets[0]({ projectId: 'test', appName: 'Yearn' }).id
  ).toBe('safe')
})

it('uses Yearn accents and separate light/dark surfaces through RainbowKit theme options', () => {
  expect(getYearnRainbowTheme('light').colors.accentColor).toBe('#0657f9')
  expect(getYearnRainbowTheme('dark').colors.modalBackground).not.toBe(
    getYearnRainbowTheme('light').colors.modalBackground
  )
})
