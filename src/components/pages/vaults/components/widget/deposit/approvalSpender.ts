import { YBOLD_ZAPPER_ADDRESS } from '@pages/vaults/utils/yBold'
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

  if (routeType === 'YBOLD_ZAPPER') {
    return {
      spenderAddress: toAddress(routerAddress || YBOLD_ZAPPER_ADDRESS),
      spenderName: 'yBOLD Zap'
    }
  }

  return {}
}
