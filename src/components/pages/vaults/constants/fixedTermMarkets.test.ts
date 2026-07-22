import { VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import { getFixedTermMarkets } from '@pages/vaults/constants/fixedTermMarkets'
import { YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { describe, expect, it } from 'vitest'

describe('getFixedTermMarkets', () => {
  it('does not advertise an inactive Pendle market for yBOLD', () => {
    expect(getFixedTermMarkets(YBOLD_VAULT_ADDRESS)).toEqual([])
  })

  it('keeps the active Pendle rewards market', () => {
    expect(getFixedTermMarkets(VAULT_ADDRESSES.PENDLE_ARB_REWARDS)).toMatchObject([
      {
        provider: 'pendle',
        label: 'Pendle'
      }
    ])
  })
})
