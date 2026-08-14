import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserEvents, VaultMetadata } from '@/server/lib/holdings/types'

const serviceMocks = vi.hoisted(() => ({
  fetchUserEvents: vi.fn(),
  getCachedWalletEvents: vi.fn(),
  saveCachedWalletEvents: vi.fn(),
  fetchMultipleVaultsMetadata: vi.fn(),
  getVaultMetadataFetchFailedVaults: vi.fn(),
  resolveNestedVaultAssetMetadata: vi.fn()
}))

vi.mock('@/server/lib/holdings/services/graphql', () => ({
  fetchUserEvents: serviceMocks.fetchUserEvents
}))

vi.mock('@/server/lib/holdings/services/walletEventCache', () => ({
  getCachedWalletEvents: serviceMocks.getCachedWalletEvents,
  saveCachedWalletEvents: serviceMocks.saveCachedWalletEvents
}))

vi.mock('@/server/lib/holdings/services/vaults', () => ({
  fetchMultipleVaultsMetadata: serviceMocks.fetchMultipleVaultsMetadata,
  getVaultMetadataFetchFailedVaults: serviceMocks.getVaultMetadataFetchFailedVaults
}))

vi.mock('@/server/lib/holdings/services/nestedVaultPrices', () => ({
  getNestedVaultPpsIdentifiersFromPriceRequests: vi.fn(() => []),
  mergeVaultIdentifiers: vi.fn((identifiers: unknown[]) => identifiers),
  resolveNestedVaultAssetMetadata: serviceMocks.resolveNestedVaultAssetMetadata
}))

vi.mock('@/server/lib/holdings/services/kong', () => ({
  fetchMultipleVaultsPPS: vi.fn()
}))

import { getSettledAddressScopedContext } from '@/server/lib/holdings/services/settledHoldingsContext'

const CACHED_USER = '0x00000000000000000000000000000000000000A1'
const ENVIO_USER = '0x00000000000000000000000000000000000000A2'
const VAULT_ADDRESS = '0x00000000000000000000000000000000000000B1'
const TOKEN_ADDRESS = '0x00000000000000000000000000000000000000C1'

const EVENTS: UserEvents = {
  deposits: [
    {
      id: 'deposit-1',
      vaultAddress: VAULT_ADDRESS,
      chainId: 1,
      blockNumber: 100,
      blockTimestamp: 1_700_000_000,
      logIndex: 1,
      transactionHash: '0xdeposit',
      transactionFrom: CACHED_USER,
      owner: CACHED_USER,
      sender: CACHED_USER,
      assets: '1000000',
      shares: '1000000000000000000'
    }
  ],
  withdrawals: [],
  transfersIn: [],
  transfersOut: []
}

const VAULT_METADATA: VaultMetadata = {
  address: VAULT_ADDRESS.toLowerCase(),
  chainId: 1,
  version: 'v3',
  category: 'volatile',
  token: {
    address: TOKEN_ADDRESS,
    symbol: 'USDC',
    decimals: 6
  },
  decimals: 18
}

describe('getSettledAddressScopedContext wallet event cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.fetchUserEvents.mockResolvedValue(EVENTS)
    serviceMocks.getCachedWalletEvents.mockResolvedValueOnce(EVENTS).mockResolvedValueOnce(null)
    serviceMocks.saveCachedWalletEvents.mockResolvedValue(true)
    serviceMocks.fetchMultipleVaultsMetadata.mockResolvedValue(
      new Map([[`1:${VAULT_ADDRESS.toLowerCase()}`, VAULT_METADATA]])
    )
    serviceMocks.resolveNestedVaultAssetMetadata.mockImplementation(async (metadata) => metadata)
    serviceMocks.getVaultMetadataFetchFailedVaults.mockReturnValue(0)
  })

  it('feeds cached and Envio events through the same calculators and saves only an Envio miss', async () => {
    const cachedContext = await getSettledAddressScopedContext({
      userAddress: CACHED_USER,
      fetchType: 'parallel',
      paginationMode: 'paged'
    })
    const envioContext = await getSettledAddressScopedContext({
      userAddress: ENVIO_USER,
      fetchType: 'parallel',
      paginationMode: 'paged'
    })
    const activityMaxTimestamp = envioContext.maxTimestamp + 24 * 60 * 60

    expect(envioContext).toEqual({ ...cachedContext, address: ENVIO_USER.toLowerCase() })
    expect(serviceMocks.fetchUserEvents).toHaveBeenCalledOnce()
    expect(serviceMocks.fetchUserEvents).toHaveBeenCalledWith(
      ENVIO_USER,
      'all',
      activityMaxTimestamp,
      'parallel',
      'paged'
    )
    expect(serviceMocks.saveCachedWalletEvents).toHaveBeenCalledOnce()
    expect(serviceMocks.saveCachedWalletEvents).toHaveBeenCalledWith(
      { userAddress: ENVIO_USER, maxTimestamp: activityMaxTimestamp },
      EVENTS
    )
  })
})
