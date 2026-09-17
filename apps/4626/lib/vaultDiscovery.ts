import { getChain } from '@erc4626/lib/chains'
import {
  AbiDecodingZeroDataError,
  type Address,
  BaseError,
  ContractFunctionRevertedError,
  erc20Abi,
  erc4626Abi,
  getAddress,
  isAddress,
  type PublicClient,
  zeroAddress
} from 'viem'

export type TVaultChoice = {
  address: Address
  chainId: number
  name: string
  symbol: string
  assetAddress?: Address
  assetSymbol?: string
  retired?: boolean
  shares?: bigint
  decimals?: number
}
export type TWalletCandidate = { address: Address; chainId: number }
const key = (vault: TWalletCandidate) => `${vault.chainId}:${vault.address.toLowerCase()}`
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** Price is deliberately irrelevant: an unpriced share token is still a candidate. */
export function parseWalletCandidates(payload: unknown): TWalletCandidate[] {
  if (!Array.isArray(payload)) throw new Error('Wallet discovery returned an invalid response.')
  const candidates = payload.flatMap((value): TWalletCandidate[] => {
    const item = record(value)
    if (!getChain(Number(item.chainId))) return []
    if (
      typeof item.token !== 'string' ||
      !isAddress(item.token) ||
      typeof item.amount !== 'string' ||
      !/^\d+$/.test(item.amount)
    )
      throw new Error('Wallet discovery returned an invalid token balance.')
    if (
      BigInt(item.amount) === 0n ||
      item.token.toLowerCase() === zeroAddress ||
      item.token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    )
      return []
    return [{ address: getAddress(item.token), chainId: Number(item.chainId) }]
  })
  return Array.from(new Map(candidates.map((candidate) => [key(candidate), candidate])).values())
}

/** Mirror the main site's selector: hide the vault and its staking alias on the same chain. */
export function parseHiddenYearnVaultTokens(payload: unknown): TWalletCandidate[] {
  if (!Array.isArray(payload)) throw new Error('The Yearn vault list returned an invalid response.')
  return payload.flatMap((value): TWalletCandidate[] => {
    const item = record(value)
    const chainId = Number(item.chainId)
    if (item.isHidden !== true || !getChain(chainId)) return []
    const staking = record(item.staking)
    return [item.address, staking.address].flatMap((address): TWalletCandidate[] => {
      if (address == null || address === zeroAddress) return []
      if (typeof address !== 'string' || !isAddress(address))
        throw new Error('The Yearn vault list contains an invalid hidden vault address.')
      return [{ address: getAddress(address), chainId }]
    })
  })
}

export function filterVisibleWalletVaults<T extends TWalletCandidate>(
  vaults: T[],
  hiddenTokens: TWalletCandidate[]
): T[] {
  const hidden = new Set(hiddenTokens.map(key))
  return vaults.filter((vault) => !hidden.has(key(vault)))
}

/** Only synchronous V3 allocator candidates on this app's supported networks. */
export function parseYearnAllocators(payload: unknown): TVaultChoice[] {
  if (!Array.isArray(payload)) throw new Error('The Yearn vault list returned an invalid response.')
  return payload
    .flatMap((value): TVaultChoice[] => {
      const item = record(value)
      if (
        item.origin !== 'yearn' ||
        item.kind !== 'Multi Strategy' ||
        item.isHidden === true ||
        !String(item.apiVersion ?? '')
          .replace(/^~/, '')
          .startsWith('3.') ||
        !getChain(Number(item.chainId))
      )
        return []
      if (typeof item.address !== 'string' || !isAddress(item.address) || typeof item.name !== 'string')
        throw new Error('The Yearn vault list contains an invalid allocator.')
      const asset = record(item.asset)
      return [
        {
          address: getAddress(item.address),
          chainId: Number(item.chainId),
          name: item.name,
          symbol: typeof item.symbol === 'string' ? item.symbol : 'Vault',
          assetAddress:
            typeof asset.address === 'string' && isAddress(asset.address) ? getAddress(asset.address) : undefined,
          assetSymbol: typeof asset.symbol === 'string' ? asset.symbol : undefined,
          retired: item.isRetired === true
        }
      ]
    })
    .sort((a, b) => Number(a.retired) - Number(b.retired) || a.name.localeCompare(b.name))
}

function isContractMismatch(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    !!error.walk((cause) => cause instanceof ContractFunctionRevertedError || cause instanceof AbiDecodingZeroDataError)
  )
}

export async function inspectWalletCandidate(
  client: Pick<PublicClient, 'multicall'>,
  candidate: TWalletCandidate,
  owner: Address
): Promise<{ vault?: TVaultChoice; unreadable: boolean }> {
  const address = candidate.address
  try {
    const [asset, balance, conversion, decimals, name, symbol] = await client.multicall({
      allowFailure: true,
      contracts: [
        { address, abi: erc4626Abi, functionName: 'asset' },
        { address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
        { address, abi: erc4626Abi, functionName: 'convertToAssets', args: [0n] },
        { address, abi: erc20Abi, functionName: 'decimals' },
        { address, abi: erc20Abi, functionName: 'name' },
        { address, abi: erc20Abi, functionName: 'symbol' }
      ]
    })
    if (asset.status === 'failure') return { unreadable: !isContractMismatch(asset.error) }
    if (asset.result.toLowerCase() === zeroAddress) return { unreadable: false }
    if (conversion.status === 'failure') return { unreadable: !isContractMismatch(conversion.error) }
    if (balance.status === 'failure' || decimals.status === 'failure') return { unreadable: true }
    if (balance.result === 0n) return { unreadable: false }
    return {
      unreadable: false,
      vault: {
        ...candidate,
        assetAddress: asset.result,
        name: name.status === 'success' ? name.result : 'ERC-4626 vault',
        symbol: symbol.status === 'success' ? symbol.result : 'Shares',
        decimals: decimals.result,
        shares: balance.result
      }
    }
  } catch {
    return { unreadable: true }
  }
}

export async function discoverWalletVaults(
  candidates: TWalletCandidate[],
  owner: Address,
  getClient: (chainId: number) => Pick<PublicClient, 'multicall'> | undefined,
  signal?: AbortSignal
) {
  const bounded = candidates.slice(0, 500)
  const batches = Array.from({ length: Math.ceil(bounded.length / 8) }, (_, i) => bounded.slice(i * 8, i * 8 + 8))
  const results = await batches.reduce(
    async (previous, batch) => {
      const collected = await previous
      signal?.throwIfAborted()
      const next = await Promise.all(
        batch.map((candidate) => {
          const client = getClient(candidate.chainId)
          return client
            ? inspectWalletCandidate(client, candidate, owner)
            : Promise.resolve<Awaited<ReturnType<typeof inspectWalletCandidate>>>({ unreadable: true })
        })
      )
      return [...collected, ...next]
    },
    Promise.resolve([] as Awaited<ReturnType<typeof inspectWalletCandidate>>[])
  )
  signal?.throwIfAborted()
  return {
    vaults: results.flatMap((result) => (result.vault ? [result.vault] : [])),
    unreadable: results.filter((result) => result.unreadable).length,
    omitted: candidates.length - bounded.length
  }
}
