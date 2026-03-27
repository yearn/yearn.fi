import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import type { DepositRouteType } from './types'

type TGetDepositApprovalSpender = {
  routeType: DepositRouteType
  destinationToken: Address
  stakingAddress?: Address
  routerAddress?: string
  vaultSymbol?: string
  stakingTokenSymbol?: string
}

type TDepositApprovalSpender = {
  spenderAddress?: Address
  spenderName?: string
}

export function getDepositApprovalSpender({
  routeType,
  destinationToken,
  stakingAddress,
  routerAddress,
  vaultSymbol,
  stakingTokenSymbol
}: TGetDepositApprovalSpender): TDepositApprovalSpender {
  if (routeType === 'ENSO') {
    return {
      spenderAddress: toAddress(routerAddress || destinationToken),
      spenderName: routerAddress ? 'Enso Router' : (vaultSymbol ?? 'Vault')
    }
  }

  if (routeType === 'DIRECT_STAKE') {
    return {
      spenderAddress: toAddress(stakingAddress || destinationToken),
      spenderName: stakingTokenSymbol || 'Staking Contract'
    }
  }

  if (routeType === 'DIRECT_DEPOSIT') {
    return {
      spenderAddress: toAddress(routerAddress || destinationToken),
      spenderName: routerAddress ? 'Yearn Zap' : (vaultSymbol ?? 'Vault')
    }
  }

  return {}
}
