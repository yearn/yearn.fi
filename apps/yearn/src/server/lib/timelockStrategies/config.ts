import type { TTimelockControllerConfig } from './types'

export const TIMELOCK_ADDRESS = '0x88Ba032be87d5EF1fbE87336B7090767F367BF73' as const

export const TIMELOCK_STRATEGY_CONTROLLERS = [
  {
    chainId: 1,
    timelockAddress: TIMELOCK_ADDRESS,
    label: 'Yearn strategy timelock',
    executorLabel: 'yChad',
    authorizedSafe: '0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52',
    minDelaySeconds: 604_800,
    defaultLookbackBlocks: 216_000n
  },
  {
    chainId: 10,
    timelockAddress: TIMELOCK_ADDRESS,
    label: 'Yearn strategy timelock',
    executorLabel: 'Yearn Optimism timelock executor',
    minDelaySeconds: 86_400,
    defaultLookbackBlocks: 1_080_000n
  },
  {
    chainId: 137,
    timelockAddress: TIMELOCK_ADDRESS,
    label: 'Yearn strategy timelock',
    executorLabel: 'Yearn Polygon timelock executor',
    minDelaySeconds: 604_800,
    defaultLookbackBlocks: 1_080_000n
  },
  {
    chainId: 8453,
    timelockAddress: TIMELOCK_ADDRESS,
    label: 'Yearn strategy timelock',
    executorLabel: 'Yearn Base timelock executor',
    minDelaySeconds: 604_800,
    defaultLookbackBlocks: 1_080_000n
  },
  {
    chainId: 42161,
    timelockAddress: TIMELOCK_ADDRESS,
    label: 'Yearn strategy timelock',
    executorLabel: 'Yearn Arbitrum timelock executor',
    minDelaySeconds: 604_800,
    defaultLookbackBlocks: 1_080_000n
  },
  {
    chainId: 747474,
    timelockAddress: TIMELOCK_ADDRESS,
    label: 'Yearn strategy timelock',
    executorLabel: 'Yearn Katana timelock executor',
    minDelaySeconds: 604_800,
    defaultLookbackBlocks: 1_080_000n
  }
] as const satisfies readonly TTimelockControllerConfig[]

export function getTimelockStrategyController(chainId: number): TTimelockControllerConfig | undefined {
  return TIMELOCK_STRATEGY_CONTROLLERS.find((controller) => controller.chainId === chainId)
}
