import { encodeFunctionData, toFunctionSignature } from 'viem'
import { describe, expect, it } from 'vitest'

import { strategyManagementAbi } from './abi'
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
const LIVE_OPERATION_ID = '0xe63a430741d287c67f94270539983b381e751464eb704dddcf7e2791adceeb7b'
const LIVE_TX_HASH = '0xddff074807d813fbc600b0d42c23b457da751d422488926ee8971e17541c0d73'
const YSWETH_VAULT = '0xAc37729B76db6438CE62042AE1270ee574CA7571'
const WETH_VAULT = '0xd7a540ba3626c0aa66e7DB4088971d0CD64695B6'
const YSUSDC_STRATEGY = '0x72978421a29d83Ca76E9E5A72EaBE2b363454596'
const YSWETH_STRATEGY_A = '0x13f6Cb609959a43c3bE29407766A683b42e26D28'
const YSWETH_STRATEGY_B = '0x5E8A9Acd00AdCED69b30D36929CbF7D4d4F9AE1F'

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

const livePendingStatus = new Map<`0x${string}`, TTimelockOperationStatus>([
  [
    LIVE_OPERATION_ID,
    {
      isPending: true,
      isReady: false,
      isDone: false,
      timestamp: 1_789_485_011
    }
  ]
])

function buildLiveBatchCall({
  args,
  functionName,
  index,
  target
}: {
  args: readonly [`0x${string}`, boolean] | readonly [`0x${string}`, bigint]
  functionName: 'add_strategy' | 'update_max_debt_for_strategy'
  index: number
  target: `0x${string}`
}): TTimelockScheduledCall {
  return {
    operationId: LIVE_OPERATION_ID,
    index,
    target,
    data: encodeFunctionData({ abi: strategyManagementAbi, functionName, args }),
    delay: 604_800,
    blockTimestamp: 1_788_911_411,
    transactionHash: LIVE_TX_HASH
  }
}

const liveBatchCalls = [
  buildLiveBatchCall({ functionName: 'add_strategy', args: [YSUSDC_STRATEGY, false], index: 0, target: USD_YVAULT }),
  buildLiveBatchCall({
    functionName: 'update_max_debt_for_strategy',
    args: [YSUSDC_STRATEGY, 2_500_000_000_000n],
    index: 1,
    target: USD_YVAULT
  }),
  buildLiveBatchCall({ functionName: 'add_strategy', args: [YSWETH_STRATEGY_A, true], index: 2, target: YSWETH_VAULT }),
  buildLiveBatchCall({
    functionName: 'update_max_debt_for_strategy',
    args: [YSWETH_STRATEGY_A, 10_000_000_000_000_000_000_000n],
    index: 3,
    target: YSWETH_VAULT
  }),
  buildLiveBatchCall({ functionName: 'add_strategy', args: [YSWETH_STRATEGY_B, true], index: 4, target: YSWETH_VAULT }),
  buildLiveBatchCall({
    functionName: 'update_max_debt_for_strategy',
    args: [YSWETH_STRATEGY_B, 10_000_000_000_000_000_000_000n],
    index: 5,
    target: YSWETH_VAULT
  }),
  buildLiveBatchCall({ functionName: 'add_strategy', args: [YSWETH_VAULT, true], index: 6, target: WETH_VAULT }),
  buildLiveBatchCall({
    functionName: 'update_max_debt_for_strategy',
    args: [YSWETH_VAULT, 500_000_000_000_000_000_000n],
    index: 7,
    target: WETH_VAULT
  }),
  {
    operationId: LIVE_OPERATION_ID,
    index: 8,
    target: '0xb3bd6B2E61753C311EFbCF0111f75D29706D9a41',
    data: UNKNOWN_DATA,
    delay: 604_800,
    blockTimestamp: 1_788_911_411,
    transactionHash: LIVE_TX_HASH
  }
] satisfies TTimelockScheduledCall[]

describe('decodePendingTimelockStrategies', () => {
  it('matches the supported strategy-management signatures in the verified vault ABI', () => {
    expect(strategyManagementAbi.map((item) => toFunctionSignature(item))).toEqual([
      'add_strategy(address)',
      'add_strategy(address,bool)',
      'update_max_debt_for_strategy(address,uint256)',
      'update_debt(address,uint256)',
      'update_debt(address,uint256,uint256)',
      'set_default_queue(address[])'
    ])
  })

  it('decodes both add_strategy overloads by selector', () => {
    const legacyData = encodeFunctionData({
      abi: strategyManagementAbi,
      functionName: 'add_strategy',
      args: [PENDING_STRATEGY]
    })
    const queueData = encodeFunctionData({
      abi: strategyManagementAbi,
      functionName: 'add_strategy',
      args: [PENDING_STRATEGY, true]
    })

    expect(legacyData.slice(0, 10)).toBe('0xde7aeb41')
    expect(queueData.slice(0, 10)).toBe('0xc2e73cca')
  })

  it('decodes the live mixed-vault batch scheduled in transaction 0xddff0748', () => {
    const decodeForVault = (vaultAddress: `0x${string}`) =>
      decodePendingTimelockStrategies({
        controller: controller!,
        vaultAddress,
        scheduledCalls: liveBatchCalls,
        operationStatuses: livePendingStatus
      })

    expect(decodeForVault(USD_YVAULT).map((item) => [item.strategyAddress, item.maxDebtRaw])).toEqual([
      [YSUSDC_STRATEGY, '2500000000000']
    ])
    expect(decodeForVault(YSWETH_VAULT).map((item) => [item.strategyAddress, item.maxDebtRaw])).toEqual([
      [YSWETH_STRATEGY_A, '10000000000000000000000'],
      [YSWETH_STRATEGY_B, '10000000000000000000000']
    ])
    expect(decodeForVault(WETH_VAULT).map((item) => [item.strategyAddress, item.maxDebtRaw])).toEqual([
      [YSWETH_VAULT, '500000000000000000000']
    ])
  })

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
