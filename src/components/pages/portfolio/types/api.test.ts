import { describe, expect, it } from 'vitest'
import { portfolioActivityResponseSchema } from './api'

describe('portfolioActivityResponseSchema', () => {
  it('accepts transfer activity entries with a direction', () => {
    const parsed = portfolioActivityResponseSchema.parse({
      address: '0x2222222222222222222222222222222222222222',
      version: 'all',
      limit: 10,
      offset: 0,
      pageInfo: {
        hasMore: false,
        nextOffset: null
      },
      entries: [
        {
          chainId: 1,
          txHash: '0xtransfer',
          timestamp: 1776902400,
          action: 'transfer',
          transferDirection: 'in',
          vaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          familyVaultAddress: '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204',
          assetSymbol: 'USDC',
          assetAmount: '0',
          assetAmountFormatted: null,
          inputTokenAddress: null,
          inputTokenSymbol: null,
          inputTokenAmount: null,
          inputTokenAmountFormatted: null,
          shareAmount: '1000000000000000000',
          shareAmountFormatted: 1,
          status: 'ok'
        }
      ]
    })

    expect(parsed.entries[0]?.action).toBe('transfer')
    expect(parsed.entries[0]?.transferDirection).toBe('in')
  })
})
