import { describe, expect, it } from 'vitest'
import { extractCurvePools, resolveCurveDepositUrl } from './VaultInfoSection'

const TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111'
const POOL_ADDRESS = '0x2222222222222222222222222222222222222222'

describe('extractCurvePools', () => {
  it('extracts pools from canonical data.poolData shape', () => {
    const pools = extractCurvePools({
      data: {
        poolData: [{ lpTokenAddress: TOKEN_ADDRESS, poolUrls: { deposit: ['https://curve.fi/deposit'] } }]
      }
    })

    expect(pools).toHaveLength(1)
  })

  it('returns empty list for root-level array payloads', () => {
    const pools = extractCurvePools([
      { lpTokenAddress: TOKEN_ADDRESS, poolUrls: { deposit: ['https://curve.fi/deposit'] } }
    ])

    expect(pools).toEqual([])
  })
})

describe('resolveCurveDepositUrl', () => {
  it('normalizes the deposit URL when lpTokenAddress matches', () => {
    const pools = extractCurvePools({
      data: {
        poolData: [{ lpTokenAddress: TOKEN_ADDRESS, poolUrls: { deposit: ['https://curve.fi/lp-match'] } }]
      }
    })

    expect(resolveCurveDepositUrl(pools, TOKEN_ADDRESS)).toBe('https://www.curve.finance/lp-match')
  })

  it('returns deposit URL when pool address matches', () => {
    const pools = extractCurvePools({
      data: {
        poolData: [{ address: POOL_ADDRESS, poolUrls: { deposit: ['https://www.curve.finance/address-match'] } }]
      }
    })

    expect(resolveCurveDepositUrl(pools, POOL_ADDRESS)).toBe('https://www.curve.finance/address-match')
  })

  it('ignores legacy key variants and returns empty string', () => {
    const pools = extractCurvePools({
      data: {
        poolData: [{ lp_token_address: TOKEN_ADDRESS, poolURLs: { deposit: ['https://curve.fi/legacy'] } }]
      }
    })

    expect(resolveCurveDepositUrl(pools, TOKEN_ADDRESS)).toBe('')
  })
})
