import { describe, expect, it } from 'vitest'
import { buildSwapSearchParams, DEFAULT_SWAP_SELECTION, parseSwapSelection } from './swapParams'

describe('swap URL parameters', () => {
  it('defaults to mainnet USDC to ETH', () => {
    expect(parseSwapSelection(new URLSearchParams())).toEqual(DEFAULT_SWAP_SELECTION)
  })

  it('round-trips supported cross-chain selections', () => {
    const selection = {
      fromChainId: 10 as const,
      fromToken: '0x4200000000000000000000000000000000000006' as const,
      toChainId: 8453 as const,
      toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
    }

    expect(parseSwapSelection(buildSwapSearchParams(selection))).toEqual(selection)
  })

  it('rejects unsupported chains and malformed addresses', () => {
    expect(parseSwapSelection(new URLSearchParams('fromChain=250&from=nope&toChain=146&to=also-nope'))).toEqual(
      DEFAULT_SWAP_SELECTION
    )
  })
})
