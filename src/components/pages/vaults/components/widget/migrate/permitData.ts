import type { usePublicClient } from '@shared/hooks/useAppWagmi'
import { PERMIT_ABI } from '@shared/hooks/usePermit'
import { hashDomain, parseAbi } from 'viem'

const DEFAULT_PERMIT_DEADLINE_MINUTES = 20

const DOMAIN_SEPARATOR_ABI = parseAbi(['function DOMAIN_SEPARATOR() external view returns (bytes32)'])
const DOMAIN_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' }
  ]
} as const

export const createPermitDeadline = () => BigInt(Math.floor(Date.now() / 1000) + 60 * DEFAULT_PERMIT_DEADLINE_MINUTES)

type BuildPermitDataParams = {
  client: NonNullable<ReturnType<typeof usePublicClient>>
  vaultAddress: `0x${string}`
  account: `0x${string}`
  spender: `0x${string}`
  value: bigint
  chainId: number
  deadline: bigint
}

export const buildVerifiedPermitData = async ({
  client,
  vaultAddress,
  account,
  spender,
  value,
  chainId,
  deadline
}: BuildPermitDataParams) => {
  const [nonceResult, nameResult, versionResult, apiVersionResult, domainSeparatorResult] = await Promise.allSettled([
    client.readContract({
      address: vaultAddress,
      abi: PERMIT_ABI,
      functionName: 'nonces',
      args: [account]
    }),
    client.readContract({
      address: vaultAddress,
      abi: PERMIT_ABI,
      functionName: 'name'
    }),
    client.readContract({
      address: vaultAddress,
      abi: PERMIT_ABI,
      functionName: 'version'
    }),
    client.readContract({
      address: vaultAddress,
      abi: PERMIT_ABI,
      functionName: 'apiVersion'
    }),
    client.readContract({
      address: vaultAddress,
      abi: DOMAIN_SEPARATOR_ABI,
      functionName: 'DOMAIN_SEPARATOR'
    })
  ])

  if (
    nonceResult.status !== 'fulfilled' ||
    nameResult.status !== 'fulfilled' ||
    domainSeparatorResult.status !== 'fulfilled'
  ) {
    return undefined
  }

  const version =
    apiVersionResult.status === 'fulfilled' && apiVersionResult.value
      ? apiVersionResult.value
      : versionResult.status === 'fulfilled' && versionResult.value
        ? versionResult.value
        : '1'

  const domain = {
    name: nameResult.value,
    version: version || '1',
    chainId,
    verifyingContract: vaultAddress
  }

  if (
    hashDomain({ domain: { ...domain, chainId: BigInt(chainId) }, types: DOMAIN_TYPES }) !== domainSeparatorResult.value
  ) {
    return undefined
  }

  return {
    domain,
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    message: {
      owner: account,
      spender,
      value,
      nonce: nonceResult.value,
      deadline
    },
    primaryType: 'Permit'
  } as const
}
