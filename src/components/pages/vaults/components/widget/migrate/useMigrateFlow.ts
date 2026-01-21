import { useTokenAllowance } from '@pages/vaults/hooks/useTokenAllowance'
import type { UseMigrateFlowReturn } from '@pages/vaults/types'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { getMigratorConfig, type MigratorConfig } from '@shared/utils/migratorRegistry'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { YEARN_4626_ROUTER } from '@/components/shared/utils'

interface UseMigrateFlowProps {
  vaultFrom: Address
  vaultTo: Address
  router: Address
  vaultVersion?: string
  balance: bigint
  account?: Address
  chainId: number
  enabled: boolean
}

export const useMigrateFlow = ({
  vaultFrom,
  vaultTo,
  router,
  vaultVersion,
  balance,
  account,
  chainId,
  enabled
}: UseMigrateFlowProps): UseMigrateFlowReturn => {
  // Get migrator config from registry or fallback to ERC_4626_ROUTER
  const migratorConfig = useMemo((): MigratorConfig => {
    const config = getMigratorConfig(router)

    // Fallback to ERC_4626_ROUTER for unknown contracts (v3 migration)
    if (!config) {
      const isSourceV3 = vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3')
      return {
        abi: ERC_4626_ROUTER_ABI,
        functionName: isSourceV3 ? 'migrate' : 'migrateFromV2',
        routerAddress: YEARN_4626_ROUTER
      }
    }

    return config
  }, [router, vaultVersion])

  // Use fallback router address if config specifies one, otherwise use the provided router
  const effectiveRouter = migratorConfig.routerAddress ?? router

  // Check current allowance to the router
  const { allowance = 0n } = useTokenAllowance({
    account,
    token: vaultFrom,
    spender: effectiveRouter,
    watch: true,
    chainId,
    enabled
  })

  const isAllowanceSufficient = allowance >= balance
  const hasBalance = balance > 0n

  // Prepare approve (when allowance insufficient)
  const prepareApproveEnabled = !isAllowanceSufficient && hasBalance && !!account && enabled
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: vaultFrom,
    args: balance > 0n ? [effectiveRouter, balance] : undefined,
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  // Prepare migrate transaction
  const prepareMigrateEnabled = hasBalance && !!account && enabled && isAllowanceSufficient

  const prepareMigrate: UseSimulateContractReturnType = useSimulateContract({
    abi: migratorConfig.abi,
    functionName: migratorConfig.functionName,
    address: effectiveRouter,
    args: balance > 0n ? [vaultFrom, vaultTo, balance] : undefined,
    account,
    chainId,
    query: { enabled: prepareMigrateEnabled }
  })

  const error = prepareMigrate.isError ? 'Migration simulation failed' : undefined

  return {
    actions: {
      prepareApprove,
      prepareMigrate
    },
    periphery: {
      isAllowanceSufficient,
      allowance,
      balance,
      prepareApproveEnabled,
      prepareMigrateEnabled,
      error
    }
  }
}
