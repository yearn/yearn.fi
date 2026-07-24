import { describe, expect, it } from 'vitest'
import { createYBoldPreset, yBoldAssetToken, yBoldRouteTokens, yBoldVaultToken } from './yBold'

describe('createYBoldPreset token selector', () => {
  it('matches the legacy default order for deposit and withdrawal assets', () => {
    const config = createYBoldPreset()

    expect(config.tokenSelector?.defaultTokens?.deposit).toEqual(
      ['BOLD', 'USDC', 'USDT', 'DAI', 'WETH'].map((symbol) => yBoldRouteTokens.find((token) => token.symbol === symbol))
    )
    expect(config.tokenSelector?.defaultTokens?.withdraw).toEqual(
      ['yBOLD', 'USDC', 'USDT', 'USDS', 'BOLD', 'WETH'].map((symbol) =>
        yBoldRouteTokens.find((token) => token.symbol === symbol)
      )
    )
    expect(config.withdrawTokens).toContain(yBoldVaultToken)
  })

  it('allows consumers to choose the assets shown before search', () => {
    const config = createYBoldPreset({ defaultAssetTokens: [yBoldAssetToken] })

    expect(config.tokenSelector?.defaultTokens?.deposit).toEqual([yBoldAssetToken])
    expect(config.tokenSelector?.defaultTokens?.withdraw).toEqual([yBoldAssetToken])
    expect(config.depositTokens).toEqual(yBoldRouteTokens)
  })
})
