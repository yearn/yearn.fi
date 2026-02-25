import { describe, expect, it } from 'vitest'
import { kongVaultSnapshotSchema } from './kongVaultSnapshotSchema'

describe('kongVaultSnapshotSchema', () => {
  it('retains Katana estimated component fields', () => {
    const parsed = kongVaultSnapshotSchema.parse({
      address: '0x0000000000000000000000000000000000000001',
      chainId: 747474,
      performance: {
        estimated: {
          apr: 0.4687,
          apy: 0.068,
          type: 'katana-estimated-apr',
          components: {
            netAPR: 0.4687,
            netAPY: 0.068,
            katanaBonusAPY: 0.068,
            katanaNativeYield: 0.027,
            katanaAppRewardsAPR: 0.0916,
            steerPointsPerDollar: 0.1883,
            fixedRateKatanaRewards: 0.35,
            FixedRateKatanaRewards: 0.36
          }
        }
      }
    })

    expect(parsed.performance?.estimated?.components?.netAPR).toBe(0.4687)
    expect(parsed.performance?.estimated?.components?.netAPY).toBe(0.068)
    expect(parsed.performance?.estimated?.components?.katanaBonusAPY).toBe(0.068)
    expect(parsed.performance?.estimated?.components?.katanaNativeYield).toBe(0.027)
    expect(parsed.performance?.estimated?.components?.katanaAppRewardsAPR).toBe(0.0916)
    expect(parsed.performance?.estimated?.components?.steerPointsPerDollar).toBe(0.1883)
    expect(parsed.performance?.estimated?.components?.fixedRateKatanaRewards).toBe(0.35)
    expect(parsed.performance?.estimated?.components?.FixedRateKatanaRewards).toBe(0.36)
  })
})
