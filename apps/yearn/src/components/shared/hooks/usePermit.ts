import { type Address, type Hex, parseAbi } from 'viem'
import type { usePublicClient } from 'wagmi'

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
