import { getChain } from '@erc4626/lib/chains'
import { getAddress, isAddress, zeroAddress } from 'viem'

export function parseVaultSelection(chain: string | undefined, address: string | undefined) {
  const chainId = chain === undefined ? 1 : Number(chain)
  if (!getChain(chainId)) return { ok: false, error: 'Choose a supported network.' } as const
  const candidate = address?.trim()
  if (!candidate || !isAddress(candidate) || candidate.toLowerCase() === zeroAddress)
    return { ok: false, error: 'Enter a valid vault address.' } as const
  return { ok: true, chainId, address: getAddress(candidate) } as const
}
