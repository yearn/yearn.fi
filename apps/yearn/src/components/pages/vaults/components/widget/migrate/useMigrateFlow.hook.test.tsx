// @vitest-environment jsdom

import { useTokenAllowance } from '@pages/vaults/hooks/useTokenAllowance'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { usePublicClient, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { detectPermitType, type TPermitSignature } from '@shared/hooks/usePermit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { type Address, decodeFunctionData, type Hex } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YEARN_4626_ROUTER, ZAP_YEARN_VE_CRV_ADDRESS } from '@/components/shared/utils'
import { useMigrateFlow } from './useMigrateFlow'

vi.mock('@shared/hooks/useAppWagmi', () => ({
  usePublicClient: vi.fn(),
  useSimulateContract: vi.fn()
}))

vi.mock('@pages/vaults/hooks/useTokenAllowance', () => ({
  useTokenAllowance: vi.fn()
}))

vi.mock('@shared/hooks/usePermit', () => ({
  detectPermitType: vi.fn().mockResolvedValue('none')
}))

const FROM_VAULT = '0x1111111111111111111111111111111111111111' as Address
const TO_VAULT = '0x2222222222222222222222222222222222222222' as Address
const ACCOUNT = '0x3333333333333333333333333333333333333333' as Address
const UNKNOWN_ROUTER = '0x4444444444444444444444444444444444444444' as Address
const BALANCE = 10n ** 18n

type TReadContractCall = { address: Address; functionName: string; args?: readonly unknown[] }

const useSimulateContractMock = vi.mocked(useSimulateContract)
const readContract = vi.fn<(call: TReadContractCall) => Promise<bigint>>()

function renderMigrateFlow(vaultVersion: string, router: Address = UNKNOWN_ROUTER, permitSignature?: TPermitSignature) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rendered = renderHook(
    () =>
      useMigrateFlow({
        vaultFrom: FROM_VAULT,
        vaultTo: TO_VAULT,
        router,
        vaultVersion,
        balance: BALANCE,
        account: ACCOUNT,
        chainId: 1,
        enabled: true,
        permitSignature
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }
  )
  return { ...rendered, queryClient }
}

function lastMigrateSimulation(functionName: string) {
  return useSimulateContractMock.mock.calls
    .map(([parameters]) => parameters)
    .findLast((parameters) => parameters?.functionName === functionName)
}

describe('useMigrateFlow quote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePublicClient).mockReturnValue({ readContract } as never)
    vi.mocked(useTokenAllowance).mockReturnValue({ allowance: BALANCE } as never)
    useSimulateContractMock.mockReturnValue({ isError: false } as never)
  })

  it('prepares a V3 migration with the minimum quoted through previewRedeem', async () => {
    readContract.mockImplementation(async ({ address, functionName, args }) => {
      if (address === FROM_VAULT && functionName === 'previewRedeem' && args?.[0] === BALANCE) return 3_000n
      if (address === TO_VAULT && functionName === 'previewDeposit' && args?.[0] === 3_000n) return 10_000n
      throw new Error(`unexpected read ${functionName}`)
    })

    const { result } = renderMigrateFlow('3.0.2')

    await waitFor(() => expect(result.current.periphery.prepareMigrateEnabled).toBe(true))
    expect(lastMigrateSimulation('migrate')).toMatchObject({
      address: YEARN_4626_ROUTER,
      args: [FROM_VAULT, TO_VAULT, BALANCE, 9_950n],
      query: { enabled: true }
    })
  })

  it('prepares a V2 migration with the minimum quoted through pricePerShare', async () => {
    readContract.mockImplementation(async ({ address, functionName, args }) => {
      if (address === FROM_VAULT && functionName === 'pricePerShare') return 2n * 10n ** 6n
      if (address === FROM_VAULT && functionName === 'decimals') return 6n
      if (address === TO_VAULT && functionName === 'previewDeposit' && args?.[0] === 2n * BALANCE) return 20_000n
      throw new Error(`unexpected read ${functionName}`)
    })

    const { result } = renderMigrateFlow('0.4.6')

    await waitFor(() => expect(result.current.periphery.prepareMigrateEnabled).toBe(true))
    expect(lastMigrateSimulation('migrateFromV2')).toMatchObject({
      address: YEARN_4626_ROUTER,
      args: [FROM_VAULT, TO_VAULT, BALANCE, 19_900n],
      query: { enabled: true }
    })
  })

  it.each(['3.0.2', '0.4.6'])('does not prepare a %s migration while the quote is pending', async (vaultVersion) => {
    readContract.mockReturnValue(new Promise(() => undefined))

    const { result } = renderMigrateFlow(vaultVersion)

    await waitFor(() => expect(result.current.periphery.isCheckingPermit).toBe(false))
    expect(readContract).toHaveBeenCalled()
    expect(result.current.periphery.prepareMigrateEnabled).toBe(false)
    expect(useSimulateContractMock.mock.calls.some(([parameters]) => parameters?.query?.enabled)).toBe(false)
  })

  it('keeps migrate args empty across the approval receipt until the quote resolves', async () => {
    const quote = Promise.withResolvers<bigint>()
    readContract.mockImplementation(({ functionName }) =>
      functionName === 'previewRedeem' ? quote.promise : Promise.resolve(10_000n)
    )
    vi.mocked(useTokenAllowance).mockReturnValue({ allowance: 0n } as never)

    const { result, rerender } = renderMigrateFlow('3.0.2')
    await waitFor(() => expect(result.current.periphery.isCheckingPermit).toBe(false))

    vi.mocked(useTokenAllowance).mockReturnValue({ allowance: BALANCE } as never)
    rerender()

    expect(result.current.periphery.isAllowanceSufficient).toBe(true)
    expect(
      useSimulateContractMock.mock.calls
        .map(([parameters]) => parameters)
        .filter((parameters) => parameters?.functionName === 'migrate')
        .every((parameters) => parameters?.args === undefined)
    ).toBe(true)

    quote.resolve(3_000n)

    await waitFor(() => expect(result.current.periphery.prepareMigrateEnabled).toBe(true))
    expect(lastMigrateSimulation('migrate')).toMatchObject({ args: [FROM_VAULT, TO_VAULT, BALANCE, 9_950n] })
  })

  it.each(['3.0.2', '0.4.6'])('does not prepare a %s migration when the quote fails', async (vaultVersion) => {
    readContract.mockRejectedValue(new Error('rpc down'))

    const { result } = renderMigrateFlow(vaultVersion)

    await waitFor(() => expect(result.current.periphery.error).toBe('Migration quote failed'))
    expect(result.current.periphery.prepareMigrateEnabled).toBe(false)
    expect(useSimulateContractMock.mock.calls.some(([parameters]) => parameters?.query?.enabled)).toBe(false)
  })

  it('prepares a veCRV zap migration with the minimum quoted through calc_expected_out', async () => {
    readContract.mockImplementation(async ({ address, functionName, args }) => {
      if (
        address === ZAP_YEARN_VE_CRV_ADDRESS &&
        functionName === 'calc_expected_out' &&
        args?.[0] === FROM_VAULT &&
        args?.[1] === TO_VAULT &&
        args?.[2] === BALANCE
      ) {
        return 10_000n
      }
      throw new Error(`unexpected read ${functionName}`)
    })

    const { result } = renderMigrateFlow('0.4.6', ZAP_YEARN_VE_CRV_ADDRESS)

    await waitFor(() => expect(result.current.periphery.prepareMigrateEnabled).toBe(true))
    expect(lastMigrateSimulation('zap')).toMatchObject({
      address: ZAP_YEARN_VE_CRV_ADDRESS,
      args: [FROM_VAULT, TO_VAULT, BALANCE, 9_950n, ACCOUNT],
      query: { enabled: true }
    })
  })

  it('stops preparing the migration when a quote refetch fails after a success', async () => {
    readContract.mockImplementation(async ({ functionName }) => (functionName === 'previewRedeem' ? 3_000n : 10_000n))

    const { result, queryClient } = renderMigrateFlow('3.0.2')
    await waitFor(() => expect(result.current.periphery.prepareMigrateEnabled).toBe(true))

    readContract.mockRejectedValue(new Error('rpc down'))
    await act(() => queryClient.refetchQueries({ queryKey: ['migration-min-shares-out'] }))

    await waitFor(() => expect(result.current.periphery.error).toBe('Migration quote failed'))
    expect(result.current.periphery.prepareMigrateEnabled).toBe(false)
  })

  it('encodes the quoted minimum into the permit multicall', async () => {
    vi.mocked(detectPermitType).mockResolvedValueOnce('eip2612')
    readContract.mockImplementation(async ({ functionName }) => (functionName === 'previewRedeem' ? 3_000n : 10_000n))
    const permitSignature = {
      r: `0x${'11'.repeat(32)}` as Hex,
      s: `0x${'22'.repeat(32)}` as Hex,
      v: 27,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      signature: '0x' as Hex
    }

    const { result } = renderMigrateFlow('3.0.2', UNKNOWN_ROUTER, permitSignature)

    await waitFor(() => expect(result.current.periphery.prepareMulticallEnabled).toBe(true))
    const calls = lastMigrateSimulation('multicall')?.args?.[0] as readonly Hex[]
    expect(result.current.periphery.routeType).toBe('permit')
    expect(decodeFunctionData({ abi: ERC_4626_ROUTER_ABI, data: calls[1] })).toMatchObject({
      functionName: 'migrate',
      args: [FROM_VAULT, TO_VAULT, BALANCE, 9_950n]
    })
  })
})
