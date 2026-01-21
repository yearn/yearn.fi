import { useTokenAllowance } from '@pages/vaults/hooks/useTokenAllowance'
import type { MigrateRouteType, UseMigrateFlowReturn } from '@pages/vaults/types'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { useMemo, useState } from 'react'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useReadContract, useSimulateContract } from 'wagmi'
import { usePermitSupport } from './usePermitSupport'

// EIP-2612 permit nonce ABI
const NONCES_ABI = [
  {
    name: 'nonces',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view'
  }
] as const

// EIP-2612 name ABI
const NAME_ABI = [
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view'
  }
] as const

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
  const [permitSignature, setPermitSignature] = useState<`0x${string}` | undefined>()

  // Check if source vault supports EIP-2612 permit
  // TODO: Permit flow is disabled for now due to signature verification issues
  // The vault's permit domain/version might differ from standard EIP-2612
  const { supportsPermit: _supportsPermit } = usePermitSupport({
    vaultAddress: vaultFrom,
    chainId,
    enabled: enabled && chainId === 1
  })
  const supportsPermit = false // Temporarily disabled - use approve flow

  // Read nonce for permit
  const { data: nonce } = useReadContract({
    address: vaultFrom,
    abi: NONCES_ABI,
    functionName: 'nonces',
    args: account ? [account] : undefined,
    chainId,
    query: { enabled: supportsPermit && !!account && enabled }
  })

  // Read token name for permit domain
  const { data: tokenName } = useReadContract({
    address: vaultFrom,
    abi: NAME_ABI,
    functionName: 'name',
    chainId,
    query: { enabled: supportsPermit && enabled }
  })

  // Check current allowance to the router
  const { allowance = 0n } = useTokenAllowance({
    account,
    token: vaultFrom,
    spender: router,
    watch: true,
    chainId,
    enabled
  })

  const isAllowanceSufficient = allowance >= balance
  const hasBalance = balance > 0n

  // Determine route type
  const routeType: MigrateRouteType = useMemo(() => {
    if (supportsPermit && !isAllowanceSufficient) return 'PERMIT'
    return 'APPROVE'
  }, [isAllowanceSufficient])

  // Prepare approve (only for APPROVE route when allowance insufficient)
  const prepareApproveEnabled = routeType === 'APPROVE' && !isAllowanceSufficient && hasBalance && !!account && enabled
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: vaultFrom,
    args: balance > 0n ? [router, balance] : undefined,
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  // Prepare migrate transaction
  // Use migrateSharesWithPermit if we have a permit signature, otherwise migrateShares
  const prepareMigrateEnabled = hasBalance && !!account && enabled && (isAllowanceSufficient || !!permitSignature)

  // For permit flow: deadline is 1 hour from now
  const deadline = useMemo(() => BigInt(Math.floor(Date.now() / 1000) + 3600), [])

  // Build permit typed data for EIP-2612 signing
  const permitData = useMemo(() => {
    if (!supportsPermit || !account || nonce === undefined || !tokenName) return undefined

    return {
      domain: {
        name: tokenName,
        version: '1',
        chainId,
        verifyingContract: vaultFrom
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      },
      primaryType: 'Permit' as const,
      message: {
        owner: account,
        spender: router,
        value: balance,
        nonce,
        deadline
      }
    }
  }, [account, nonce, tokenName, chainId, vaultFrom, router, balance, deadline])

  const isSourceV3 = vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3')
  const migrateFunctionName = isSourceV3 ? 'migrate' : 'migrateFromV2'
  const migrateArgs = balance > 0n ? ([vaultFrom, vaultTo, balance, 0n] as const) : undefined

  const prepareMigrate: UseSimulateContractReturnType = useSimulateContract({
    abi: ERC_4626_ROUTER_ABI,
    functionName: migrateFunctionName,
    address: router,
    args: migrateArgs,
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
      routeType,
      supportsPermit,
      isAllowanceSufficient,
      allowance,
      balance,
      prepareApproveEnabled,
      prepareMigrateEnabled,
      permitSignature,
      setPermitSignature,
      permitData,
      deadline,
      error
    }
  }
}
