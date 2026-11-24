// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  isStakingContractForVault,
  type TReadStakingUnderlying,
  useVerifiedStakingAddress
} from '@yearn/vault-widget/internal/hooks/useVerifiedStakingAddress'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readContract } from 'wagmi/actions'

vi.mock('wagmi', () => ({ useConfig: vi.fn(() => ({})) }))
vi.mock('wagmi/actions', () => ({ readContract: vi.fn() }))
vi.mock('@yearn/vault-widget/runtime', () => ({ useVaultWidgetRuntime: vi.fn() }))

type TVerifiedStakingAddress = ReturnType<typeof useVerifiedStakingAddress>

const VAULT_ADDRESS = '0x182863131F9a4630fF9E27830d945B1413e347E8'
const STAKING_ADDRESS = '0xd57aEa3686d623dA2dCEbc87010a4F2F38Ac7B15'
const OTHER_ADDRESS = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8'

const reverted = (): Promise<never> => Promise.reject(new Error('execution reverted'))

function createRead(results: Record<string, () => Promise<unknown>>): TReadStakingUnderlying {
  return ({ functionName }) => (results[functionName] ?? reverted)()
}

describe('isStakingContractForVault', () => {
  it('accepts a gauge whose asset() is the vault', async () => {
    const read = createRead({ asset: async () => VAULT_ADDRESS.toLowerCase() })

    await expect(
      isStakingContractForVault({ read, stakingAddress: STAKING_ADDRESS, vaultAddress: VAULT_ADDRESS })
    ).resolves.toBe(true)
  })

  it('accepts a staking rewards contract whose stakingToken() is the vault', async () => {
    const read = createRead({ stakingToken: async () => VAULT_ADDRESS })

    await expect(
      isStakingContractForVault({ read, stakingAddress: STAKING_ADDRESS, vaultAddress: VAULT_ADDRESS })
    ).resolves.toBe(true)
  })

  it('rejects a staking contract that stakes a different token', async () => {
    const read = createRead({ asset: async () => OTHER_ADDRESS, stakingToken: async () => OTHER_ADDRESS })

    await expect(
      isStakingContractForVault({ read, stakingAddress: STAKING_ADDRESS, vaultAddress: VAULT_ADDRESS })
    ).resolves.toBe(false)
  })

  it('rejects a non-address response', async () => {
    const read = createRead({ asset: async () => 123n })

    await expect(
      isStakingContractForVault({ read, stakingAddress: STAKING_ADDRESS, vaultAddress: VAULT_ADDRESS })
    ).resolves.toBe(false)
  })

  it('fails when the contract exposes neither view', async () => {
    const read = createRead({})

    await expect(
      isStakingContractForVault({ read, stakingAddress: STAKING_ADDRESS, vaultAddress: VAULT_ADDRESS })
    ).rejects.toThrow()
  })
})

describe('useVerifiedStakingAddress', () => {
  const readContractMock = vi.mocked(readContract)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useVaultWidgetRuntime).mockReturnValue({
      chains: { resolveExecutionChainId: (chainId: number) => chainId }
    } as never)
  })

  function renderVerifiedStakingAddress(): ReturnType<typeof renderHook<TVerifiedStakingAddress, unknown>> {
    const queryClient = new QueryClient()
    return renderHook(
      () => useVerifiedStakingAddress({ stakingAddress: STAKING_ADDRESS, vaultAddress: VAULT_ADDRESS, chainId: 1 }),
      {
        wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
      }
    )
  }

  it('withholds the staking address until it is verified', async () => {
    readContractMock.mockImplementation((_config, { functionName }) =>
      functionName === 'asset' ? Promise.resolve(VAULT_ADDRESS) : reverted()
    )

    const { result } = renderVerifiedStakingAddress()

    expect(result.current.verifiedStakingAddress).toBeUndefined()
    expect(result.current.isVerifyingStaking).toBe(true)
    await waitFor(() => expect(result.current.verifiedStakingAddress).toBe(STAKING_ADDRESS))
    expect(result.current.isVerifyingStaking).toBe(false)
  })

  it('never returns a staking contract that stakes a different token', async () => {
    readContractMock.mockImplementation((_config, { functionName }) =>
      functionName === 'stakingToken' ? Promise.resolve(OTHER_ADDRESS) : reverted()
    )

    const { result } = renderVerifiedStakingAddress()

    await waitFor(() => expect(result.current.isVerifyingStaking).toBe(false))
    expect(result.current.verifiedStakingAddress).toBeUndefined()
  })
})
