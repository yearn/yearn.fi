import { getValidatedEnsoRouterAddress, UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE } from '@pages/vaults/utils/ensoRouters'
import { YBOLD_ZAPPER_ADDRESS } from '@pages/vaults/utils/yBold'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import type { DepositRouteType } from './types'

type TGetDepositApprovalSpender = {
  routeType: DepositRouteType
  destinationToken: Address
  chainId?: number
  stakingAddress?: Address
  routerAddress?: string
  vaultSymbol?: string
  stakingTokenSymbol?: string
}

type TDepositApprovalSpender = {
  spenderAddress?: Address
  spenderName?: string
  approvalWarning?: string
}

export function getDepositApprovalSpender({
  routeType,
  destinationToken,
  chainId,
  stakingAddress,
  routerAddress,
  vaultSymbol,
  stakingTokenSymbol
}: TGetDepositApprovalSpender): TDepositApprovalSpender {
  if (routeType === 'ENSO') {
    if (!routerAddress) {
      return {}
    }

    const validatedRouterAddress =
      chainId === undefined
        ? undefined
        : getValidatedEnsoRouterAddress({
            chainId,
            routerAddress
          })

    if (!validatedRouterAddress) {
      return {
        spenderAddress: toAddress(routerAddress),
        spenderName: 'Enso Router',
        approvalWarning: UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE
      }
    }

    return {
      spenderAddress: validatedRouterAddress,
      spenderName: 'Enso Router'
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
