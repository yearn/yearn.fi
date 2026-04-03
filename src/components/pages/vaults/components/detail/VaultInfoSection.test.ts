import { YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { YVUSD_LOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'
import { extractCurvePools, getVaultDocsLinks, resolveCurveDepositUrl } from './VaultInfoSection'

const TOKEN_ADDRESS = '0x1111111111111111111111111111111111111111'
const POOL_ADDRESS = '0x2222222222222222222222222222222222222222'
const DEFAULT_VAULT_ADDRESS = '0x3333333333333333333333333333333333333333'

function createVaultTokenAddress(address = DEFAULT_VAULT_ADDRESS): `0x${string}` {
  return address as `0x${string}`
}

describe('getVaultDocsLinks', () => {
  it('returns yvUSD docs by address', () => {
    expect(getVaultDocsLinks(YVUSD_LOCKED_ADDRESS, 'yvUSD', '2')).toStrictEqual({
      developerDocumentationUrl: 'https://docs.yearn.fi/developers/yvusd/',
      userDocumentationUrl: 'https://docs.yearn.fi/getting-started/products/yvaults/yvusd'
    })
  })

  it('returns yBOLD docs by address', () => {
    expect(getVaultDocsLinks(YBOLD_VAULT_ADDRESS, 'yBOLD', '2')).toStrictEqual({
      developerDocumentationUrl: 'https://docs.yearn.fi/developers/v3/overview',
      userDocumentationUrl: 'https://docs.yearn.fi/getting-started/products/yvaults/yBold'
    })
  })

  it('returns yCRV docs by symbol', () => {
    expect(
      getVaultDocsLinks(createVaultTokenAddress('0x1111111111111111111111111111111111111111'), 'ycrv', '2')
    ).toStrictEqual({
      developerDocumentationUrl: 'https://docs.yearn.fi/developers/building-on-yearn',
      userDocumentationUrl: 'https://docs.yearn.fi/getting-started/products/ylockers/ycrv/overview'
    })
  })

  it('returns yYB docs by symbol', () => {
    expect(
      getVaultDocsLinks(createVaultTokenAddress('0x1111111111111111111111111111111111111112'), 'yyb', '2')
    ).toStrictEqual({
      developerDocumentationUrl: 'https://docs.yearn.fi/developers/building-on-yearn',
      userDocumentationUrl: 'https://docs.yearn.fi/getting-started/products/ylockers/yyb/overview'
    })
  })

  it('returns v3 docs by version fallback', () => {
    expect(getVaultDocsLinks(DEFAULT_VAULT_ADDRESS as `0x${string}`, 'some-symbol', '3')).toStrictEqual({
      developerDocumentationUrl: 'https://docs.yearn.fi/developers/v3/overview',
      userDocumentationUrl: 'https://docs.yearn.fi/getting-started/products/yvaults/v3'
    })
  })

  it('returns v2 docs by version fallback', () => {
    expect(getVaultDocsLinks(DEFAULT_VAULT_ADDRESS as `0x${string}`, 'some-symbol', '2')).toStrictEqual({
      developerDocumentationUrl: 'https://docs.yearn.fi/developers/building-on-yearn',
      userDocumentationUrl: 'https://docs.yearn.fi/getting-started/products/yvaults/v2'
    })
  })
})

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
