// @vitest-environment jsdom

import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { useStakingAssetConversions } from '@shared/hooks/useStakingAssetConversions'
import { toNormalizedBN } from '@shared/utils/format'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ withdrawableAssets: vi.fn() }))
vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useConfig: () => ({})
}))
vi.mock('@pages/vaults/hooks/actions/stakingAdapter', () => ({
  getStakingWithdrawableAssets: mocks.withdrawableAssets
}))

const account = '0x1111111111111111111111111111111111111111'
const stakingAddress = '0x2222222222222222222222222222222222222222'
const allVaults = {
  vault: {
    chainId: 1,
    address: account,
    staking: { address: stakingAddress, source: 'test', available: true, rewards: [] }
  } as unknown as TKongVault
}
const getBalance = () => toNormalizedBN(10n, 0)

afterEach(cleanup)

it('only publishes changed conversion values, including during refetches and account changes', async () => {
  const queryClient = new QueryClient()
  mocks.withdrawableAssets.mockResolvedValue(20n)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result, rerender } = renderHook(
    ({ userAddress }: { userAddress?: typeof account }) =>
      useStakingAssetConversions({ allVaults, getBalance, userAddress }),
    { initialProps: { userAddress: undefined as typeof account | undefined }, wrapper }
  )
  const empty = result.current
  rerender({ userAddress: undefined })
  expect(result.current).toBe(empty)

  rerender({ userAddress: account })
  await waitFor(() => expect(result.current).toEqual({ [`1/${stakingAddress}`]: 20n }))
  const settled = result.current
  rerender({ userAddress: account })
  expect(result.current).toBe(settled)
  await act(async () => queryClient.refetchQueries())
  expect(result.current).toBe(settled)

  mocks.withdrawableAssets.mockResolvedValue(30n)
  await act(async () => queryClient.refetchQueries())
  await waitFor(() => expect(result.current).toEqual({ [`1/${stakingAddress}`]: 30n }))
  expect(result.current).not.toBe(settled)
  rerender({ userAddress: undefined })
  expect(result.current).toEqual({})
  queryClient.clear()
})
