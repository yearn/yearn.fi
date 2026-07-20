import { describe, expect, it } from 'vitest'
import { buildPendingTimelockStrategiesUrl } from './usePendingTimelockStrategies'

describe('buildPendingTimelockStrategiesUrl', () => {
  it('builds the timelock strategies API URL', () => {
    expect(
      buildPendingTimelockStrategiesUrl({
        chainId: 1,
        vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987'
      })
    ).toBe('/api/vaults/timelock-strategies?chainId=1&vault=0x696d02Db93291651ED510704c9b286841d506987')
  })
})
