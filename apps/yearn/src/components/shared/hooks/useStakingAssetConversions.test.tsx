// @vitest-environment jsdom

import { getVaultChainID, getVaultStaking, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { useStakingAssetConversions } from '@shared/hooks/useStakingAssetConversions'
import { useQueries } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import { type Address, zeroAddress } from 'viem'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@pages/vaults/domain/kongVaultSelectors', () => ({
  getVaultChainID: vi.fn(() => 1),
  getVaultStaking: vi.fn(() => ({
    address: '0x0000000000000000000000000000000000000002',
    source: 'Yearn'
  }))
}))
vi.mock('@pages/vaults/hooks/actions/stakingAdapter', () => ({ getStakingWithdrawableAssets: vi.fn() }))
vi.mock('@shared/utils', async () => ({
  ...(await import('@shared/utils/tools.address')),
  ...(await import('@shared/utils/tools.is'))
}))
vi.mock('@tanstack/react-query', () => ({ useQueries: vi.fn(() => []) }))
vi.mock('wagmi', () => ({ useConfig: () => ({}) }))
vi.mock('wagmi/actions', () => ({ readContract: vi.fn() }))
vi.mock('@/config/tenderly', () => ({
  resolveExecutionChainId: (chainID: number) => chainID,
  supportedCanonicalChains: [],
  supportedExecutionChains: []
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('skips catalog scans without an eligible account and resumes when one becomes available', () => {
  const allVaults = {
    vault: { address: '0x0000000000000000000000000000000000000001' } as unknown as TKongVault
  }
  const getBalance = vi.fn(() => ({ raw: 1n, normalized: 1, display: '1', decimals: 0 }))
  const { rerender } = renderHook(
    ({ userAddress }: { userAddress: Address | undefined }) =>
      useStakingAssetConversions({ allVaults, getBalance, userAddress }),
    { initialProps: { userAddress: undefined as Address | undefined } }
  )

  rerender({ userAddress: zeroAddress })
  expect(getVaultStaking).not.toHaveBeenCalled()
  expect(getVaultChainID).not.toHaveBeenCalled()
  expect(getBalance).not.toHaveBeenCalled()
  expect(useQueries).toHaveBeenLastCalledWith({ queries: [] })

  rerender({ userAddress: '0x0000000000000000000000000000000000000003' })
  expect(getVaultStaking).toHaveBeenCalledExactlyOnceWith(allVaults.vault)
  expect(getBalance).toHaveBeenCalledExactlyOnceWith({
    address: '0x0000000000000000000000000000000000000002',
    chainID: 1
  })
  expect(useQueries).toHaveBeenLastCalledWith({
    queries: [expect.objectContaining({ enabled: true })]
  })

  rerender({ userAddress: undefined })
  expect(getVaultStaking).toHaveBeenCalledTimes(1)
  expect(useQueries).toHaveBeenLastCalledWith({ queries: [] })

  rerender({ userAddress: '0x0000000000000000000000000000000000000003' })
  expect(getVaultStaking).toHaveBeenCalledTimes(2)
  expect(useQueries).toHaveBeenLastCalledWith({
    queries: [expect.objectContaining({ enabled: true })]
  })
})
