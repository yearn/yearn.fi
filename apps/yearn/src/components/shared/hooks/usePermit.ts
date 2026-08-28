import { useCallback, useState } from 'react'
import { type Address, type Hex, hexToNumber, parseAbi, slice } from 'viem'
import { useAccount, usePublicClient, useSignTypedData } from 'wagmi'

export const PERMIT_ABI = [
  {
    inputs: [],
    stateMutability: 'view',
    type: 'function',
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }]
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
    name: 'nonces',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }]
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'apiVersion',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'EIP712_VERSION',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

export type TPermitSignature = {
  r: Hex
  s: Hex
  v: number
  deadline: bigint
  signature: Hex
}

type SignPermitParams = {
  tokenAddress: Address
  spenderAddress: Address
  value: bigint
  deadline: bigint
  chainId: number
}

export const usePermit = () => {
  const { address: account } = useAccount()
  const client = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const signPermit = useCallback(
    async ({
      tokenAddress,
      spenderAddress,
      value,
      deadline,
      chainId: targetChainId
    }: SignPermitParams): Promise<TPermitSignature | undefined> => {
      if (!account || !client) return undefined

      setIsLoading(true)
      setError(undefined)

      try {
        // Read contract metadata in parallel
        const [nonceResult, nameResult, versionResult, apiVersionResult] = await Promise.allSettled([
          client.readContract({
            address: tokenAddress,
            abi: PERMIT_ABI,
            functionName: 'nonces',
            args: [account]
          }),
          client.readContract({
            address: tokenAddress,
            abi: PERMIT_ABI,
            functionName: 'name'
          }),
          client.readContract({
            address: tokenAddress,
            abi: PERMIT_ABI,
            functionName: 'version'
          }),
          client.readContract({
            address: tokenAddress,
            abi: PERMIT_ABI,
            functionName: 'apiVersion'
          })
        ])

        const nonce = nonceResult.status === 'fulfilled' ? nonceResult.value : 0n
        const name = nameResult.status === 'fulfilled' ? nameResult.value : ''
        // Yearn V3 vaults use apiVersion for EIP-712 domain, prioritize it over version()
        const version =
          apiVersionResult.status === 'fulfilled' && apiVersionResult.value
            ? apiVersionResult.value
            : versionResult.status === 'fulfilled' && versionResult.value
              ? versionResult.value
              : '1'

        const types = {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
          ]
        }

        const domain = {
          name,
          version: version || '1',
          chainId: targetChainId,
          verifyingContract: tokenAddress
        }

        const message = {
          owner: account,
          spender: spenderAddress,
          value,
          nonce,
          deadline
        }

        const signature = await signTypedDataAsync({
          account,
          domain,
          primaryType: 'Permit',
          types,
          message
        })

        const r = slice(signature, 0, 32)
        const s = slice(signature, 32, 64)
        const v = hexToNumber(slice(signature, 64, 65))

        setIsLoading(false)
        return { r, s, v, deadline, signature }
      } catch (err: any) {
        setIsLoading(false)
        const isUserRejection =
          err?.message?.toLowerCase().includes('rejected') ||
          err?.message?.toLowerCase().includes('denied') ||
          err?.code === 4001

        if (!isUserRejection) {
          setError(err?.message || 'Failed to sign permit')
        }
        return undefined
      }
    },
    [account, client, signTypedDataAsync]
  )

  return {
    signPermit,
    isLoading,
    error
  }
}

export const isPermitSupported = async (
  client: ReturnType<typeof usePublicClient>,
  tokenAddress: Address,
  _chainId: number
): Promise<boolean> => {
  if (!client) return false

  try {
    const data = await client.readContract({
      address: tokenAddress,
      abi: parseAbi(['function DOMAIN_SEPARATOR() external view returns (bytes32)']),
      functionName: 'DOMAIN_SEPARATOR'
    })
    return Boolean(data)
  } catch {
    return false
  }
}

const EIP2612_PERMIT_TYPEHASH = '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'

// Detect if token uses standard EIP-2612 permit or DAI-style permit
export type PermitType = 'eip2612' | 'dai' | 'none'

export const detectPermitType = async (
  client: ReturnType<typeof usePublicClient>,
  tokenAddress: Address
): Promise<PermitType> => {
  if (!client) return 'none'

  try {
    // First check if DOMAIN_SEPARATOR exists (required for both types)
    await client.readContract({
      address: tokenAddress,
      abi: parseAbi(['function DOMAIN_SEPARATOR() external view returns (bytes32)']),
      functionName: 'DOMAIN_SEPARATOR'
    })

    // Try to read PERMIT_TYPEHASH to determine type
    try {
      const typehash = await client.readContract({
        address: tokenAddress,
        abi: parseAbi(['function PERMIT_TYPEHASH() external view returns (bytes32)']),
        functionName: 'PERMIT_TYPEHASH'
      })

      // Check if it matches EIP-2612 typehash
      if (typehash === EIP2612_PERMIT_TYPEHASH) {
        return 'eip2612'
      }
      // Otherwise assume DAI-style
      return 'dai'
    } catch {
      // PERMIT_TYPEHASH not exposed, assume EIP-2612 (most common)
      return 'eip2612'
    }
  } catch {
    return 'none'
  }
}
