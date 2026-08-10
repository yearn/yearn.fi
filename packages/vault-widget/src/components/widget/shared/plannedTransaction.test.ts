import {
  buildEligibleStyledWidgetPlan,
  type TBuildEligibleStyledWidgetPlanParams
} from '@yearn/vault-widget/internal/components/widget/shared/plannedTransaction'
import type { AppUseSimulateContractReturnType } from '@yearn/vault-widget/types'
import { decodeFunctionData, parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'

const depositAbi = parseAbi(['function deposit(uint256 amount, address receiver)'])
const vaultAddress = '0x2222222222222222222222222222222222222222' as const
const account = '0x1111111111111111111111111111111111111111' as const

function createReadyPrepare(requestOverrides: Record<string, unknown> = {}): AppUseSimulateContractReturnType {
  return {
    data: {
      request: {
        abi: depositAbi,
        address: vaultAddress,
        args: [10n, account],
        chainId: 1,
        functionName: 'deposit',
        ...requestOverrides
      }
    },
    isError: false,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    status: 'success'
  }
}

function createParams(
  overrides: Partial<TBuildEligibleStyledWidgetPlanParams> = {}
): TBuildEligibleStyledWidgetPlanParams {
  return {
    canonicalChainId: 1,
    connectedCanonicalChainId: 1,
    id: 'deposit:direct:10',
    isCrossChain: false,
    isExecutionConfigured: true,
    isWalletSafe: false,
    label: 'Deposit',
    mode: 'deposit',
    needsApproval: false,
    prepare: createReadyPrepare(),
    routeType: 'DIRECT_DEPOSIT',
    ...overrides
  }
}

describe('buildEligibleStyledWidgetPlan', () => {
  it('encodes one ready simulation into an EOA execute-and-refresh plan', () => {
    const plan = buildEligibleStyledWidgetPlan(createParams())

    expect(plan?.steps.map(({ kind }) => kind)).toEqual(['execute', 'refresh'])
    expect(plan?.intent.calls).toHaveLength(1)
    expect(plan?.intent.calls[0]?.request).toMatchObject({ chainId: 1, to: vaultAddress })
    expect(
      decodeFunctionData({
        abi: depositAbi,
        data: plan?.intent.calls[0]?.request.data ?? '0x'
      })
    ).toEqual({ functionName: 'deposit', args: [10n, account] })
  })

  it('preserves prepared calldata and native value while using the canonical chain', () => {
    const plan = buildEligibleStyledWidgetPlan(
      createParams({
        prepare: createReadyPrepare({ chainId: 73571, data: '0x1234', value: 7n })
      })
    )

    expect(plan?.intent.calls[0]?.request).toEqual({
      chainId: 1,
      to: vaultAddress,
      data: '0x1234',
      value: 7n
    })
  })

  it.each([
    ['Safe', { isWalletSafe: true }],
    ['unconfigured execution', { isExecutionConfigured: false }],
    ['cross-chain', { isCrossChain: true }],
    ['approval', { needsApproval: true }],
    ['batch', { hasBatch: true }],
    ['permit', { isPermit: true }],
    ['disabled', { isEnabled: false }],
    ['Enso', { routeType: 'ENSO' }],
    ['direct unstake-withdraw', { mode: 'withdraw', routeType: 'DIRECT_UNSTAKE_WITHDRAW' }]
  ] satisfies readonly [
    string,
    Partial<TBuildEligibleStyledWidgetPlanParams>
  ][])('rejects %s flows', (_name, overrides) => {
    expect(buildEligibleStyledWidgetPlan(createParams(overrides))).toBeUndefined()
  })

  it('rejects a missing or different connected canonical chain', () => {
    expect(buildEligibleStyledWidgetPlan(createParams({ connectedCanonicalChainId: undefined }))).toBeUndefined()
    expect(buildEligibleStyledWidgetPlan(createParams({ connectedCanonicalChainId: 10 }))).toBeUndefined()
  })

  it('rejects custom Enso execution markers even on an otherwise eligible route', () => {
    expect(
      buildEligibleStyledWidgetPlan(
        createParams({ prepare: createReadyPrepare({ __isEnsoOrder: true, data: '0x1234' }) })
      )
    ).toBeUndefined()
  })

  it('rejects incomplete or unsuccessful prepared requests', () => {
    expect(
      buildEligibleStyledWidgetPlan(
        createParams({
          prepare: {
            ...createReadyPrepare(),
            data: { request: { address: vaultAddress } }
          }
        })
      )
    ).toBeUndefined()
    expect(
      buildEligibleStyledWidgetPlan(
        createParams({ prepare: { ...createReadyPrepare(), isSuccess: false, status: 'pending' } })
      )
    ).toBeUndefined()
  })
})
