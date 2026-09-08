import { describe, expect, it } from 'vitest'
import {
  getYearnWagmiStorageKey,
  isLedgerLiveProvider,
  isSafeAppOrigin,
  resolveYearnWalletRuntime
} from '@/config/walletRuntime'

describe('Yearn wallet runtime', () => {
  it('uses the normal app runtime outside an iframe', () => {
    expect(resolveYearnWalletRuntime({ ancestorOrigin: 'https://app.safe.global', isIframe: false })).toBe('app')
  })

  it('recognizes only the exact secure Safe app origin', () => {
    expect(isSafeAppOrigin('https://app.safe.global')).toBe(true)
    expect(isSafeAppOrigin('https://app.safe.global/')).toBe(true)
    expect(isSafeAppOrigin('http://app.safe.global')).toBe(false)
    expect(isSafeAppOrigin('https://evil-safe.example')).toBe(false)
    expect(isSafeAppOrigin('https://app.safe.global.evil.example')).toBe(false)
  })

  it('selects Safe only for the approved Safe parent', () => {
    expect(resolveYearnWalletRuntime({ ancestorOrigin: 'https://app.safe.global', isIframe: true })).toBe('safe-iframe')
    expect(
      resolveYearnWalletRuntime({
        ancestorOrigin: 'https://app.safe.global',
        hasLedgerLiveProvider: true,
        isIframe: true
      })
    ).toBe('safe-iframe')
    expect(resolveYearnWalletRuntime({ ancestorOrigin: 'https://eth.blockscout.com', isIframe: true })).toBe(
      'ledger-iframe'
    )
  })

  it('detects the modern Ledger Wallet provider without requiring an iframe', () => {
    expect(isLedgerLiveProvider({ isLedgerLive: true, request: () => undefined })).toBe(true)
    expect(isLedgerLiveProvider({ isLedgerLive: false })).toBe(false)
    expect(isLedgerLiveProvider(undefined)).toBe(false)
    expect(resolveYearnWalletRuntime({ hasLedgerLiveProvider: true, isIframe: false })).toBe('ledger-iframe')
  })

  it('keeps iframe Wagmi persistence separate from the main app', () => {
    expect(getYearnWagmiStorageKey('app')).toBe('wagmi')
    expect(getYearnWagmiStorageKey('safe-iframe')).toBe('yearn-safe-iframe')
    expect(getYearnWagmiStorageKey('ledger-iframe')).toBe('yearn-ledger-iframe')
  })
})
