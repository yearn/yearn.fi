import { describe, expect, it } from 'vitest'

import { getTimelockStrategyController } from './config'
import { decodePendingTimelockStrategies, type TTimelockOperationStatus, type TTimelockScheduledCall } from './decode'

const FORWARDED_OPERATION_ID = '0x5dac358a2f25b7148ebb9bca035dc4739fae4092086f4e8f98cc201f7e773a98'
const USD_YVAULT = '0x696d02Db93291651ED510704c9b286841d506987'
const OTHER_VAULT = '0x1111111111111111111111111111111111111111'
const PENDING_STRATEGY = '0x908244B6ef0e52911a380a5454aEC0743598Fb20'
const ADD_STRATEGY_DATA = '0xde7aeb41000000000000000000000000908244b6ef0e52911a380a5454aec0743598fb20'
const UPDATE_MAX_DEBT_DATA =
  '0xb9ddcd68000000000000000000000000908244b6ef0e52911a380a5454aec0743598fb2000000000000000000000000000000000000000000000000000005af3107a4000'
const UNKNOWN_DATA = '0x12345678'
const TX_HASH = '0xa6e8a54c3ff514951bca921cc38af55278980937816e5d04cd2d88fcf406199c'

const controller = getTimelockStrategyController(1)

function buildCalls(target: `0x${string}` = USD_YVAULT): TTimelockScheduledCall[] {
  return [
    {
      operationId: FORWARDED_OPERATION_ID,
      index: 0,
      target,
      data: ADD_STRATEGY_DATA,
      delay: 604_800,
      blockTimestamp: 1_780_000_000,
      transactionHash: TX_HASH
    },
    {
      operationId: FORWARDED_OPERATION_ID,
      index: 1,
      target,
      data: UPDATE_MAX_DEBT_DATA,
      delay: 604_800,
      blockTimestamp: 1_780_000_000,
      transactionHash: TX_HASH
    },
    {
      operationId: FORWARDED_OPERATION_ID,
      index: 2,
      target,
      data: UNKNOWN_DATA,
      delay: 604_800,
      blockTimestamp: 1_780_000_000,
      transactionHash: TX_HASH
    }
  ]
}

const pendingStatus = new Map<`0x${string}`, TTimelockOperationStatus>([
  [
    FORWARDED_OPERATION_ID,
    {
      isPending: true,
      isReady: true,
      isDone: false,
      timestamp: 1_780_509_347
    }
  ]
])

describe('decodePendingTimelockStrategies', () => {
  it('decodes the forwarded operation into one pending strategy candidate', () => {
    expect(controller).toBeDefined()
    const [candidate] = decodePendingTimelockStrategies({
      controller: controller!,
      vaultAddress: USD_YVAULT,
      scheduledCalls: buildCalls(),
      operationStatuses: pendingStatus,
      strategyMetadata: new Map([[PENDING_STRATEGY, { name: 'Base Yearn Morpho OG USDC', symbol: 'ysUSDC' }]])
    })

    expect(candidate.strategyAddress).toBe(PENDING_STRATEGY)
    expect(candidate.status).toBe('ready')
    expect(candidate.strategyName).toBe('Base Yearn Morpho OG USDC')
  })

  it('captures max debt from the companion call', () => {
    const [candidate] = decodePendingTimelockStrategies({
      controller: controller!,
      vaultAddress: USD_YVAULT,
      scheduledCalls: buildCalls(),
      operationStatuses: pendingStatus
    })

    expect(candidate.maxDebtRaw).toBe('100000000000000')
  })

  it('filters out operations that are already done', () => {
    const items = decodePendingTimelockStrategies({
      controller: controller!,
      vaultAddress: USD_YVAULT,
      scheduledCalls: buildCalls(),
      operationStatuses: new Map([
        [FORWARDED_OPERATION_ID, { ...pendingStatus.get(FORWARDED_OPERATION_ID)!, isDone: true }]
      ])
    })

    expect(items).toEqual([])
  })

  it('filters out operations that target a different vault', () => {
    const items = decodePendingTimelockStrategies({
      controller: controller!,
      vaultAddress: USD_YVAULT,
      scheduledCalls: buildCalls(OTHER_VAULT),
      operationStatuses: pendingStatus
    })

    expect(items).toEqual([])
  })

  it('ignores unknown selectors without failing', () => {
    const [candidate] = decodePendingTimelockStrategies({
      controller: controller!,
      vaultAddress: USD_YVAULT,
      scheduledCalls: buildCalls(),
      operationStatuses: pendingStatus
    })

    expect(candidate.decodedCalls.map((call) => call.signature)).toEqual([
      'add_strategy(address)',
      'update_max_debt_for_strategy(address,uint256)'
    ])
  })
})
