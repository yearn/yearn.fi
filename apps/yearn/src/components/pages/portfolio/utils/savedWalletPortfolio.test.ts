import type { TPortfolioBreakdownResponse, TPortfolioBreakdownVault } from '@pages/portfolio/types/api'
import {
  combineWalletHistory,
  combineWalletPositions,
  createBundleShareUrl,
  findBundleBySnapshot,
  parseBundleShare,
  parsePortfolioBundles,
  parseSavedWallets
} from '@pages/portfolio/utils/savedWalletPortfolio'
import { describe, expect, it } from 'vitest'
import type { TCoveredHoldingsHistory } from '@/types/holdingsHistory'

const first = '0x1111111111111111111111111111111111111111'
const second = '0x2222222222222222222222222222222222222222'
const vaultAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const day = '2026-11-16'

function snapshot(address: string, vaults: TPortfolioBreakdownVault[]): TPortfolioBreakdownResponse {
  return {
    address,
    date: day,
    version: 'all',
    timestamp: 0,
    summary: {
      totalVaults: vaults.length,
      vaultsWithShares: vaults.length,
      totalUsdValue: 0,
      missingMetadata: 0,
      missingPps: 0,
      missingPrice: 0
    },
    issues: { missingMetadata: [], missingPps: [], missingPrice: [] },
    vaults
  }
}

const vault: TPortfolioBreakdownVault = {
  chainId: 1,
  vaultAddress,
  shares: '9007199254740993',
  sharesFormatted: 0.009,
  usdValue: 12,
  pricePerShare: 1,
  tokenPrice: 1,
  metadata: { symbol: 'USDC', decimals: 18, tokenAddress: first },
  status: 'ok'
}

describe('saved wallet portfolio', () => {
  it('round-trips the saved bundle name and addresses in a share link fragment', () => {
    const bundle = { id: 'browser-local-id', name: 'Épargne 🌱 & +', wallets: [first, second] } as const
    const url = new URL(createBundleShareUrl('https://yearn.fi', { ...bundle, wallets: [...bundle.wallets] }))
    expect(url.origin + url.pathname + url.search).toBe('https://yearn.fi/portfolio')
    expect(parseBundleShare(new URLSearchParams(url.hash.slice(1)).get('bundle') ?? '')).toEqual({
      name: bundle.name,
      wallets: bundle.wallets
    })
  })

  it('reuses only a bundle with the same name and set of addresses', () => {
    const bundle = { id: 'saved', name: 'Savings', wallets: [first, second] } as const
    const saved = { ...bundle, wallets: [...bundle.wallets] }
    expect(findBundleBySnapshot([saved], { name: bundle.name, wallets: [second, first] })).toBe(saved)
    expect(findBundleBySnapshot([saved], { name: bundle.name, wallets: [second] })).toBeUndefined()
    expect(findBundleBySnapshot([saved], { name: 'Other', wallets: saved.wallets })).toBeUndefined()
  })

  it('rejects an invalid share snapshot without dropping individual wallets', () => {
    expect(parseBundleShare('bad JSON')).toBeNull()
    expect(parseBundleShare(JSON.stringify({ version: 1, name: 'Savings', wallets: [first, 'bad'] }))).toBeNull()
    expect(parseBundleShare(JSON.stringify({ version: 2, name: 'Savings', wallets: [first] }))).toBeNull()
    expect(parseBundleShare(JSON.stringify({ version: 1, name: 'Savings', wallets: [] }))).toBeNull()
  })

  it('opens the old wallet list as a named bundle and retains separate saved memberships', () => {
    expect(parsePortfolioBundles(JSON.stringify([first, second, first]))).toEqual([
      { id: 'saved-wallets', name: 'Saved wallets', wallets: [first, second] }
    ])
    expect(
      parsePortfolioBundles(
        JSON.stringify([
          { id: 'long-term', name: ' Long-term ', wallets: [first, 'invalid'] },
          { id: 'research', name: 'Research', wallets: [second, second] }
        ])
      )
    ).toEqual([
      { id: 'long-term', name: 'Long-term', wallets: [first] },
      { id: 'research', name: 'Research', wallets: [second] }
    ])
  })

  it('normalizes and deduplicates stored wallets and discards invalid entries', () => {
    expect(
      parseSavedWallets(JSON.stringify([vaultAddress, '0x' + vaultAddress.slice(2).toUpperCase(), 'bad', first]))
    ).toEqual([vaultAddress, first])
    expect(parseSavedWallets('corrupted data')).toEqual([])
  })

  it('combines exact shares within a chain and preserves unavailable wallet valuations', () => {
    const result = combineWalletPositions(
      [
        snapshot(first, [vault, { ...vault, chainId: 8453, usdValue: 4 }]),
        snapshot(second, [{ ...vault, usdValue: null, status: 'missing_price' }])
      ],
      day
    )

    expect(result.fullyValuedWallets).toBe(1)
    expect(result.value).toBe(16)
    expect(result.rows).toMatchObject([
      {
        chainId: 1,
        shares: 18_014_398_509_481_986n,
        value: 12,
        wallets: [
          { address: first, value: 12 },
          { address: second, value: null }
        ]
      },
      { chainId: 8453, value: 4 }
    ])
    expect(combineWalletPositions([undefined, snapshot(second, [])], day).value).toBe(0)
    expect(combineWalletPositions([undefined, undefined], day).value).toBeNull()
  })

  it('joins daily wallet values in one series and preserves the distinction between unavailable and zero', () => {
    const a: TCoveredHoldingsHistory = {
      address: first,
      denomination: 'usd',
      timeframe: '1y',
      dataPoints: [
        { date: '2026-11-13', value: 12, coverage: 'complete' },
        { date: '2026-11-14', value: 8, coverage: 'complete' },
        { date: '2026-11-15', value: null, coverage: 'unavailable' },
        { date: day, value: 0, coverage: 'complete' }
      ]
    }
    const b: TCoveredHoldingsHistory = {
      ...a,
      address: second,
      dataPoints: [
        { date: '2026-11-14', value: 2, coverage: 'partial' },
        { date: day, value: 0, coverage: 'complete' }
      ]
    }

    expect(combineWalletHistory([a, b], day)).toEqual([
      { date: '2026-11-13', value: 12 },
      { date: '2026-11-14', value: 10 },
      { date: '2026-11-15', value: null },
      { date: day, value: 0 }
    ])
  })
})
