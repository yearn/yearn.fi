import { useTokenAllowance } from '@pages/vaults/hooks/useTokenAllowance'
import type { MigrateRouteType, UseMigrateFlowReturn } from '@pages/vaults/types'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { isPermitSupported, type TPermitSignature } from '@shared/hooks/usePermit'
import { getMigratorConfig, type MigratorConfig } from '@shared/utils/migratorRegistry'
import { useEffect, useMemo, useState } from 'react'
import { type Address, encodeFunctionData, erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, usePublicClient, useSimulateContract } from 'wagmi'
import { YEARN_4626_ROUTER } from '@/components/shared/utils'

// Default permit deadline: 20 minutes from now
const DEFAULT_PERMIT_DEADLINE_MINUTES = 20

interface UseMigrateFlowProps {
  vaultFrom: Address
  vaultTo: Address
  router: Address
  vaultVersion?: string
  balance: bigint
  account?: Address
  chainId: number
  enabled: boolean
  permitSignature?: TPermitSignature // Provided after user signs permit
}

export const useMigrateFlow = ({
  vaultFrom,
  vaultTo,
  router,
  vaultVersion,
  balance,
  account,
  chainId,
  enabled,
  permitSignature
}: UseMigrateFlowProps): UseMigrateFlowReturn => {
  const client = usePublicClient({ chainId })
  const [supportsPermit, setSupportsPermit] = useState(false)
  const [isCheckingPermit, setIsCheckingPermit] = useState(true)

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
  const effectiveRouter = (migratorConfig.routerAddress ?? router) as Address

  // Check if vault token supports permit
  useEffect(() => {
    const checkPermitSupport = async () => {
      if (!enabled || !client) {
        setIsCheckingPermit(false)
        return
      }

      setIsCheckingPermit(true)
      const supported = await isPermitSupported(client, vaultFrom, chainId)
      setSupportsPermit(supported)
      setIsCheckingPermit(false)
    }

    checkPermitSupport()
  }, [client, vaultFrom, chainId, enabled])

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

  // Determine route type: permit (if supported) or approve
  const routeType: MigrateRouteType = supportsPermit ? 'permit' : 'approve'

  // Permit deadline - 20 minutes from now
  const permitDeadline = useMemo(() => {
    return BigInt(Math.floor(Date.now() / 1000) + 60 * DEFAULT_PERMIT_DEADLINE_MINUTES)
  }, [])

  // Prepare approve (when using approve flow and allowance insufficient)
  const prepareApproveEnabled = routeType === 'approve' && !isAllowanceSufficient && hasBalance && !!account && enabled
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: vaultFrom,
    args: balance > 0n ? [effectiveRouter, balance] : undefined,
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  // Prepare direct migrate transaction (for approve flow after approval)
  const prepareMigrateEnabled = routeType === 'approve' && hasBalance && !!account && enabled && isAllowanceSufficient
  const prepareMigrate: UseSimulateContractReturnType = useSimulateContract({
    abi: migratorConfig.abi,
    functionName: migratorConfig.functionName,
    address: effectiveRouter,
    args: balance > 0n ? [vaultFrom, vaultTo, balance] : undefined,
    account,
    chainId,
    query: { enabled: prepareMigrateEnabled }
  })

  // Prepare multicall transaction (for permit flow: selfPermit + migrate)
  const hasValidPermitSignature = !!permitSignature && permitSignature.deadline > BigInt(Math.floor(Date.now() / 1000))
  const prepareMulticallEnabled =
    routeType === 'permit' && hasBalance && !!account && enabled && hasValidPermitSignature

  // Encode multicall data: selfPermit + migrate
  const multicallData = useMemo(() => {
    if (!prepareMulticallEnabled || !permitSignature || balance <= 0n) {
      return undefined
    }

    // Encode selfPermit call
    const selfPermitData = encodeFunctionData({
      abi: ERC_4626_ROUTER_ABI,
      functionName: 'selfPermit',
      args: [vaultFrom, balance, permitSignature.deadline, permitSignature.v, permitSignature.r, permitSignature.s]
    })
    console.log({ selfPermitData })
    // Encode migrate call
    const migrateData = encodeFunctionData({
      abi: migratorConfig.abi,
      functionName: migratorConfig.functionName,
      args: [vaultFrom, vaultTo, balance]
    })
    console.log({ migrateData })

    return [selfPermitData, migrateData]
  }, [
    prepareMulticallEnabled,
    permitSignature,
    balance,
    vaultFrom,
    vaultTo,
    migratorConfig.abi,
    migratorConfig.functionName
  ])

  const prepareMulticall: UseSimulateContractReturnType = useSimulateContract({
    abi: ERC_4626_ROUTER_ABI,
    functionName: 'multicall',
    address: effectiveRouter,
    args: multicallData ? [multicallData] : undefined,
    account,
    chainId,
    query: { enabled: prepareMulticallEnabled && !!multicallData }
  })

  // Determine error state
  const error = useMemo(() => {
    if (isCheckingPermit) return undefined
    if (routeType === 'approve' && prepareMigrate.isError) return 'Migration simulation failed'
    if (routeType === 'permit' && prepareMulticall.isError) return 'Migration simulation failed'
    return undefined
  }, [isCheckingPermit, routeType, prepareMigrate.isError, prepareMulticall.isError])

  return {
    actions: {
      prepareApprove,
      prepareMigrate,
      prepareMulticall
    },
    periphery: {
      isAllowanceSufficient,
      allowance,
      balance,
      prepareApproveEnabled,
      prepareMigrateEnabled,
      prepareMulticallEnabled,
      routeType,
      supportsPermit,
      permitDeadline,
      routerAddress: effectiveRouter,
      error
    }
  }
}
