import * as z from 'zod'

const SOLVER = [
  'Vanilla',
  'PartnerContract',
  'ChainCoin',
  'InternalMigration',
  'OptimismBooster',
  'GaugeStakingBooster',
  'JuicedStakingBooster',
  'V3StakingBooster',
  'Cowswap',
  'Portals',
  'None'
] as const

export const Solver = z.enum(SOLVER)

export type TSolver = z.infer<typeof Solver>
