import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/yBoldProduct'
import { buildVaultSnapshotEndpoint } from '@shared/data/publicQueryEndpoints'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildVaultMetadataFromInput, buildVaultStructuredDataFromInput, fetchVaultMetadataSnapshot } from './metadata'

const { fetchWithSchemaMock } = vi.hoisted(() => ({
  fetchWithSchemaMock: vi.fn()
}))

vi.mock('@shared/utils/fetchQuery', () => ({
  fetchWithSchema: fetchWithSchemaMock
}))

const BASE_SNAPSHOT = {
  meta: {
    displayName: 'yBOLD',
    displaySymbol: 'yBOLD',
    token: { symbol: 'BOLD' }
  },
  apy: {
    net: 0.0552,
    weeklyNet: 0.0552
  },
  performance: {
    estimated: { apy: 0.2 },
    oracle: { netAPY: 0.0552 }
  },
  tvl: { close: 5_890_000 }
} as any

const STAKED_SNAPSHOT = {
  apy: {
    net: 0.0495,
    weeklyNet: 0.046
  },
  performance: {
    estimated: { apy: 0.2 },
    oracle: { netAPY: 0.0495 }
  }
} as any

describe('yBOLD vault metadata', () => {
  beforeEach(() => {
    fetchWithSchemaMock.mockReset()
  })

  it('fetches and merges the staked snapshot for the vanilla yBOLD route', async () => {
    fetchWithSchemaMock.mockResolvedValueOnce(BASE_SNAPSHOT).mockResolvedValueOnce(STAKED_SNAPSHOT)

    const snapshot = await fetchVaultMetadataSnapshot('1', YBOLD_VAULT_ADDRESS)

    expect(fetchWithSchemaMock).toHaveBeenNthCalledWith(
      1,
      buildVaultSnapshotEndpoint(1, YBOLD_VAULT_ADDRESS),
      expect.anything(),
      { timeout: 7000 }
    )
    expect(fetchWithSchemaMock).toHaveBeenNthCalledWith(
      2,
      buildVaultSnapshotEndpoint(1, YBOLD_STAKING_ADDRESS),
      expect.anything(),
      { timeout: 7000 }
    )
    expect(snapshot?.apy?.weeklyNet).toBe(0.046)
    expect(snapshot?.performance?.oracle?.netAPY).toBe(0.0495)
  })

  it('publishes the higher of staked weeklyNet and oracle.netAPY', () => {
    const metadata = buildVaultMetadataFromInput({
      chainID: '1',
      address: YBOLD_VAULT_ADDRESS,
      snapshot: {
        ...BASE_SNAPSHOT,
        apy: { ...BASE_SNAPSHOT.apy, weeklyNet: 0.046 },
        performance: { ...BASE_SNAPSHOT.performance, oracle: { netAPY: 0.0495 } }
      }
    })
    const structuredData = buildVaultStructuredDataFromInput({
      chainID: '1',
      address: YBOLD_VAULT_ADDRESS,
      snapshot: {
        ...BASE_SNAPSHOT,
        apy: { ...BASE_SNAPSHOT.apy, weeklyNet: 0.051 },
        performance: { ...BASE_SNAPSHOT.performance, oracle: { netAPY: 0.0495 } }
      }
    }) as { annualPercentageRate: { value: number } }

    expect(metadata.description).toContain('Est. APY 4.95%')
    expect(metadata.description).not.toContain('20.00%')
    expect(structuredData.annualPercentageRate.value).toBe(5.1)
  })
})
