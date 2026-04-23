import { describe, expect, it } from 'vitest'
import type { VaultMetadata } from '../types'
import {
  deriveNestedVaultAssetPriceData,
  expandNestedVaultAssetPriceRequests,
  getNestedVaultPpsIdentifiersFromPriceRequests,
  mergeVaultIdentifiers
} from './nestedVaultPrices'
import { toVaultKey } from './pnlShared'

const INNER_VAULT = '0x696d02db93291651ed510704c9b286841d506987'
const OUTER_VAULT = '0xaaafea48472f77563961cdb53291dedfb46f9040'
const UNDERLYING = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

const metadata = new Map<string, VaultMetadata>([
  [
    toVaultKey(1, INNER_VAULT),
    {
      address: INNER_VAULT,
      chainId: 1,
      version: 'v3',
      category: 'stable',
      token: {
        address: UNDERLYING,
        symbol: 'USDC',
        decimals: 6
      },
      decimals: 6
    }
  ],
  [
    toVaultKey(1, OUTER_VAULT),
    {
      address: OUTER_VAULT,
      chainId: 1,
      version: 'v3',
      category: 'stable',
      token: {
        address: INNER_VAULT,
        symbol: 'yvUSD',
        decimals: 6
      },
      decimals: 6
    }
  ]
])

describe('nested vault asset prices', () => {
  it('expands vault-share asset price requests with the inner vault underlying token', () => {
    const requests = expandNestedVaultAssetPriceRequests(
      [
        {
          chainId: 1,
          address: INNER_VAULT,
          timestamps: [100, 200],
          uncachedTimestamps: [200]
        }
      ],
      metadata
    )

    expect(requests).toEqual([
      {
        chainId: 1,
        address: INNER_VAULT,
        timestamps: [100, 200],
        uncachedTimestamps: [200]
      },
      {
        chainId: 1,
        address: UNDERLYING,
        timestamps: [100, 200],
        uncachedTimestamps: [200]
      }
    ])
  })

  it('requests PPS for known vault-share assets', () => {
    expect(
      getNestedVaultPpsIdentifiersFromPriceRequests(
        [
          {
            chainId: 1,
            address: INNER_VAULT,
            timestamps: [100]
          }
        ],
        metadata
      )
    ).toEqual([{ chainId: 1, vaultAddress: INNER_VAULT }])
  })

  it('derives missing vault-share token prices from inner PPS and underlying token price', () => {
    const priceData = deriveNestedVaultAssetPriceData({
      priceData: new Map([
        [`ethereum:${INNER_VAULT}`, new Map([[100, 1.005]])],
        [
          `ethereum:${UNDERLYING}`,
          new Map([
            [100, 0.999],
            [200, 1.001]
          ])
        ]
      ]),
      priceRequests: [
        {
          chainId: 1,
          address: INNER_VAULT,
          timestamps: [100, 200]
        }
      ],
      vaultMetadata: metadata,
      ppsData: new Map([
        [
          toVaultKey(1, INNER_VAULT),
          new Map([
            [100, 1.01],
            [200, 1.02]
          ])
        ]
      ])
    })

    const derivedInnerPrices = priceData.get(`ethereum:${INNER_VAULT}`)
    expect(derivedInnerPrices?.get(100)).toBe(1.005)
    expect(derivedInnerPrices?.get(200)).toBeCloseTo(1.02102)
  })

  it('dedupes PPS identifiers while preserving chain and vault address', () => {
    expect(
      mergeVaultIdentifiers([
        { chainId: 1, vaultAddress: OUTER_VAULT },
        { chainId: 1, vaultAddress: OUTER_VAULT.toUpperCase() },
        { chainId: 1, vaultAddress: INNER_VAULT }
      ])
    ).toEqual([
      { chainId: 1, vaultAddress: OUTER_VAULT },
      { chainId: 1, vaultAddress: INNER_VAULT }
    ])
  })
})
