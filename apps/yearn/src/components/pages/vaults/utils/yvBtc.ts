import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'

export const YVBTC_CHAIN_ID = 1
export const YVBTC_UNLOCKED_ADDRESS = toAddress('0xb8787E236e699654F910CAD14F338d0DdB529Fd7') as Address
export const YVBTC_LOCKED_ADDRESS = toAddress('0x0000000000000000000000000000000000000000') as Address
export const YVBTC_DESCRIPTION =
  'BTC-denominated vault. A locked yvBTC variant is planned, but the locked contract address is a temporary placeholder until launch.'
export const YVBTC_CUSTOM_RISK_SCORE = '3/5'

export type TYvBtcRiskScoreItem = {
  label: string
  explanation: string
  score?: number | string | null
  isOverall?: boolean
}

export const YVBTC_RISK_SCORE_ITEMS: TYvBtcRiskScoreItem[] = [
  {
    label: 'Overall Risk Score',
    score: YVBTC_CUSTOM_RISK_SCORE,
    isOverall: true,
    explanation:
      'yvBTC combines leverage looping, fixed-term and principal-token strategies, cross-chain capital routing, and a locked-share wrapper, so its risks are better described as a strategy stack rather than a single standard vault profile.'
  },
  {
    label: 'Leverage Looping',
    explanation:
      'Some yvBTC strategies use leverage loops to amplify supply yield. That adds borrow-rate risk, deleveraging and liquidation-path risk, and dependence on collateral efficiency, market depth, and the health of the underlying lending venue.'
  },
  {
    label: 'Duration and PT Strategies',
    explanation:
      'yvBTC can allocate into duration trades and Pendle principal-token strategies. Those positions depend on fixed-term market pricing, yield-curve assumptions, basis convergence into expiry, and the ability to exit or rebalance without meaningful slippage.'
  },
  {
    label: 'Cross-Chain Routing',
    explanation:
      'Capital may be deployed to remote vaults and bridged back through native bridges. That introduces bridge availability risk, remote chain execution risk, settlement delays, and additional operational dependencies beyond a single-chain vault.'
  }
]

export function isYvBtcAddress(address?: string | null): boolean {
  if (!address) {
    return false
  }

  return toAddress(address) === YVBTC_UNLOCKED_ADDRESS
}

export function isYvBtcVault(vault?: TKongVaultInput | null): boolean {
  if (!vault) {
    return false
  }

  return isYvBtcAddress(vault.address)
}
