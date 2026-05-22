import { useTokenAllowance } from '@pages/vaults/hooks/useTokenAllowance'
import type { MigrateRouteType, UseMigrateFlowReturn } from '@pages/vaults/types'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import {
  type AppUseSimulateContractReturnType,
  usePublicClient,
  useReadContract,
  useSimulateContract
} from '@shared/hooks/useAppWagmi'
import { detectPermitType, type PermitType, type TPermitSignature } from '@shared/hooks/usePermit'
import { getMigratorConfig, type MigratorConfig } from '@shared/utils/migratorRegistry'
import { toBasisPoints } from '@shared/utils/slippage'
import { useEffect, useMemo, useState } from 'react'
import { type Address, encodeFunctionData, erc20Abi } from 'viem'

interface UseMigrateFlowProps {
  vaultFrom: Address
  vaultTo: Address
  router: Address
  vaultVersion?: string
  balance: bigint
  account?: Address
  chainId: number
  enabled: boolean
  slippage: number
  permitSignature?: TPermitSignature // Provided after user signs permit
  permitDomainVerified?: boolean
}

const MAX_BASIS_POINTS = 10_000n

export function migratorSupportsMinSharesOut({
  abi,
  functionName
}: Pick<MigratorConfig, 'abi' | 'functionName'>): boolean {
  return abi.some(
    (item) =>
      item.type === 'function' &&
      item.name === functionName &&
      item.inputs.length === 4 &&
      item.inputs[3]?.name === 'minSharesOut'
  )
}

export function calculateMigrateMinSharesOut({
  expectedSharesOut,
  slippageBps
}: {
  expectedSharesOut: bigint
  slippageBps: number
}): bigint {
  if (expectedSharesOut <= 0n) return 0n

  const sanitizedSlippageBps = BigInt(Math.min(Number(MAX_BASIS_POINTS), Math.max(0, Math.floor(slippageBps))))
  const multiplier = MAX_BASIS_POINTS - sanitizedSlippageBps

  return (expectedSharesOut * multiplier) / MAX_BASIS_POINTS
}

export function buildProtectedMigrateArgs({
  vaultFrom,
  vaultTo,
  balance,
  minSharesOut
}: {
  vaultFrom: Address
  vaultTo: Address
  balance: bigint
  minSharesOut: bigint
}): readonly [Address, Address, bigint, bigint] {
  return [vaultFrom, vaultTo, balance, minSharesOut]
}

export function encodeProtectedMigrateData({
  migratorConfig,
  vaultFrom,
  vaultTo,
  balance,
  minSharesOut
}: {
  migratorConfig: MigratorConfig
  vaultFrom: Address
  vaultTo: Address
  balance: bigint
  minSharesOut: bigint
}): `0x${string}` {
  return encodeFunctionData({
    abi: migratorConfig.abi,
    functionName: migratorConfig.functionName,
    args: buildProtectedMigrateArgs({ vaultFrom, vaultTo, balance, minSharesOut })
  })
}

export const supportsMigratePermitFlow = ({
  hasMigratorConfig,
  permitType,
  vaultVersion
}: {
  hasMigratorConfig: boolean
  permitType: PermitType
  vaultVersion?: string
}): boolean => {
  const isV2Vault = !vaultVersion?.startsWith('3') && !vaultVersion?.startsWith('~3')
  return hasMigratorConfig && permitType === 'eip2612' && !isV2Vault
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
  slippage,
  permitSignature,
  permitDomainVerified = true
}: UseMigrateFlowProps): UseMigrateFlowReturn => {
  const client = usePublicClient({ chainId })
  const [permitType, setPermitType] = useState<PermitType>('none')
  const [isCheckingPermit, setIsCheckingPermit] = useState(true)

  // Get migrator config from the active chain registry or Ethereum-only ERC_4626_ROUTER fallback.
  const migratorConfig = useMemo((): MigratorConfig | undefined => {
    return getMigratorConfig(chainId, router, vaultVersion)
  }, [chainId, router, vaultVersion])

  // Use the chain-scoped router config when present.
  const hasMigratorConfig = !!migratorConfig
  const effectiveRouter = (migratorConfig?.routerAddress ?? router) as Address
  const supportsMinSharesOut = useMemo(
    () => (migratorConfig ? migratorSupportsMinSharesOut(migratorConfig) : false),
    [migratorConfig]
  )

  // Check what type of permit the vault token supports
  useEffect(() => {
    let isCurrent = true

    const checkPermitSupport = async () => {
      if (!enabled || !client || !hasMigratorConfig) {
        setPermitType('none')
        setIsCheckingPermit(false)
        return
      }

      setIsCheckingPermit(true)
      const type = await detectPermitType(client, vaultFrom)
      if (isCurrent) {
        setPermitType(type)
        setIsCheckingPermit(false)
      }
    }

    checkPermitSupport()

    return () => {
      isCurrent = false
    }
  }, [client, vaultFrom, enabled, hasMigratorConfig])

  // Check current allowance to the router
  const { allowance = 0n } = useTokenAllowance({
    account,
    token: vaultFrom,
    spender: effectiveRouter,
    watch: true,
    chainId,
    enabled: enabled && hasMigratorConfig
  })

  const isAllowanceSufficient = allowance >= balance
  const hasBalance = balance > 0n
  const slippageBps = toBasisPoints(slippage)

  const {
    data: expectedAssetsOut,
    isError: isPreviewAssetsError,
    isLoading: isPreviewAssetsLoading
  } = useReadContract({
    address: vaultFrom,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: [balance],
    chainId,
    query: { enabled: enabled && hasBalance && supportsMinSharesOut }
  })

  const {
    data: expectedSharesOut,
    isError: isPreviewSharesError,
    isLoading: isPreviewSharesLoading
  } = useReadContract({
    address: vaultTo,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    args: [expectedAssetsOut ?? 0n],
    chainId,
    query: { enabled: enabled && hasBalance && supportsMinSharesOut && (expectedAssetsOut ?? 0n) > 0n }
  })

  const minSharesOut = useMemo(
    () =>
      calculateMigrateMinSharesOut({
        expectedSharesOut: expectedSharesOut ?? 0n,
        slippageBps
      }),
    [expectedSharesOut, slippageBps]
  )
  const isQuoteLoading = isPreviewAssetsLoading || isPreviewSharesLoading
  const isQuoteError = isPreviewAssetsError || isPreviewSharesError
  const hasReliableQuote = !isQuoteLoading && !isQuoteError && (expectedSharesOut ?? 0n) > 0n && minSharesOut > 0n
  const canProtectMigration = supportsMinSharesOut && hasReliableQuote

  // Only use permit flow for V3 vaults with EIP-2612 style permits
  // V2 vaults have a different permit signature (Bytes[65] instead of v,r,s) that's incompatible with selfPermit
  const supportsPermit =
    supportsMigratePermitFlow({ hasMigratorConfig, permitType, vaultVersion }) && permitDomainVerified

  // Determine route type: permit (if V3 with EIP-2612) or approve (V2 or no permit)
  const routeType: MigrateRouteType = supportsPermit ? 'permit' : 'approve'

  // Prepare approve (when using approve flow and allowance insufficient)
  const prepareApproveEnabled =
    routeType === 'approve' && !isAllowanceSufficient && hasBalance && !!account && enabled && hasMigratorConfig
  const prepareApprove: AppUseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: vaultFrom,
    args: balance > 0n ? [effectiveRouter, balance] : undefined,
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareMigrateEnabled =
    routeType === 'approve' && hasBalance && !!account && enabled && isAllowanceSufficient && canProtectMigration
  const prepareMigrate: AppUseSimulateContractReturnType = useSimulateContract({
    abi: migratorConfig?.abi ?? ERC_4626_ROUTER_ABI,
    functionName: (migratorConfig?.functionName ?? 'migrate') as 'migrate',
    address: effectiveRouter,
    args:
      balance > 0n && canProtectMigration
        ? buildProtectedMigrateArgs({ vaultFrom, vaultTo, balance, minSharesOut })
        : undefined,
    account,
    chainId,
    query: { enabled: prepareMigrateEnabled }
  })

  // Prepare multicall transaction (for permit flow: selfPermit + migrate)
  const hasValidPermitSignature = !!permitSignature && permitSignature.deadline > BigInt(Math.floor(Date.now() / 1000))
  const prepareMulticallEnabled =
    routeType === 'permit' && hasBalance && !!account && enabled && hasValidPermitSignature && canProtectMigration

  // Encode multicall data: selfPermit + migrate
  const multicallData = useMemo(() => {
    if (!prepareMulticallEnabled || !permitSignature || balance <= 0n || !migratorConfig) {
      return undefined
    }

    // Encode selfPermit call
    const selfPermitData = encodeFunctionData({
      abi: ERC_4626_ROUTER_ABI,
      functionName: 'selfPermit',
      args: [vaultFrom, balance, permitSignature.deadline, permitSignature.v, permitSignature.r, permitSignature.s]
    })

    const migrateData = encodeProtectedMigrateData({ migratorConfig, vaultFrom, vaultTo, balance, minSharesOut })

    return [selfPermitData, migrateData]
  }, [prepareMulticallEnabled, permitSignature, balance, vaultFrom, vaultTo, minSharesOut, migratorConfig])

  const prepareMulticall: AppUseSimulateContractReturnType = useSimulateContract({
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
    if (hasBalance && !supportsMinSharesOut) return 'Migration output floor unavailable'
    if (hasBalance && !isQuoteLoading && !hasReliableQuote) return 'Migration quote unavailable'
    if (routeType === 'approve' && prepareMigrate.isError) return 'Migration simulation failed'
    if (routeType === 'permit' && prepareMulticall.isError) return 'Migration simulation failed'
    return undefined
  }, [
    isCheckingPermit,
    hasBalance,
    supportsMinSharesOut,
    isQuoteLoading,
    hasReliableQuote,
    routeType,
    prepareMigrate.isError,
    prepareMulticall.isError
  ])

  return {
    actions: {
      prepareApprove,
      prepareMigrate,
      prepareMulticall
    },
    periphery: {
      isAllowanceSufficient,
      isCheckingPermit,
      allowance,
      balance,
      prepareApproveEnabled,
      prepareMigrateEnabled,
      prepareMulticallEnabled,
      routeType,
      supportsPermit,
      routerAddress: effectiveRouter,
      expectedSharesOut: expectedSharesOut ?? 0n,
      minSharesOut,
      error
    }
  }
}
