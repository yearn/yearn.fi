import { getChain } from '@erc4626/lib/chains'
import { vaultAbi } from '@yearn/vault-widget/internal/contracts/abi/vaultV2.abi'
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
  assetDecimals?: number
  product?: 'single' | 'lp' | 'legacy' | 'other'
  strategy?: boolean
  legacy?: boolean
  factory?: boolean
  hidden?: boolean
  origin?: string
  category?: string
  tvlUsd?: number
}
export type TWalletCandidate = { address: Address; chainId: number }
const key = (vault: TWalletCandidate) => `${vault.chainId}:${vault.address.toLowerCase()}`
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
const isStbDepositor = (name: unknown) => typeof name === 'string' && /stb[\s_-]*depositor\b/i.test(name)

/** Prioritize same-chain wallet positions, then known TVL descending. Missing TVL stays unavailable. */
export function sortVaultChoices(
  vaults: readonly TVaultChoice[],
  holdings: readonly TWalletCandidate[] = []
): TVaultChoice[] {
  const held = new Set(holdings.map(key))
  return [...vaults].sort(
    (a, b) =>
      Number(held.has(key(b))) - Number(held.has(key(a))) ||
      (b.tvlUsd ?? -1) - (a.tvlUsd ?? -1) ||
      a.name.localeCompare(b.name) ||
      a.chainId - b.chainId ||
      a.address.localeCompare(b.address)
  )
}

/** Kong's unfiltered catalog includes external ERC-4626 candidates and legacy Yearn contracts. */
export function parseIndexedVaults(payload: unknown, { includeHidden = false } = {}): TVaultChoice[] {
  if (!Array.isArray(payload)) throw new Error('The vault catalog returned an invalid response.')
  const choices = payload.flatMap((value): TVaultChoice[] => {
    const item = record(value)
    const asset = record(item.asset)
    if (
      (!includeHidden && (item.isHidden === true || isStbDepositor(item.name))) ||
      !getChain(Number(item.chainId)) ||
      typeof item.address !== 'string' ||
      !isAddress(item.address) ||
      item.address === zeroAddress ||
      typeof asset.address !== 'string' ||
      !isAddress(asset.address)
    )
      return []
    const v3 =
      item.v3 === true ||
      String(item.apiVersion ?? '')
        .replace(/^~/, '')
        .startsWith('3.')
    const yearn = item.origin === 'yearn'
    const factory =
      item.type === 'Automated Yearn Vault' ||
      item.type === 'Automated' ||
      String(item.name ?? '')
        .toLowerCase()
        .includes('factory')
    const legacy = !v3 && (item.kind === 'Legacy' || factory)
    return [
      {
        address: getAddress(item.address),
        chainId: Number(item.chainId),
        name: typeof item.name === 'string' ? item.name : 'ERC-4626 vault',
        symbol: typeof item.symbol === 'string' ? item.symbol : 'Shares',
        assetAddress: getAddress(asset.address),
        assetSymbol: typeof asset.symbol === 'string' ? asset.symbol : undefined,
        decimals:
          Number.isInteger(item.decimals) && Number(item.decimals) >= 0 && Number(item.decimals) <= 255
            ? Number(item.decimals)
            : undefined,
        assetDecimals:
          Number.isInteger(asset.decimals) && Number(asset.decimals) >= 0 && Number(asset.decimals) <= 255
            ? Number(asset.decimals)
            : undefined,
        retired: item.isRetired === true,
        legacy,
        factory: yearn && factory && !v3,
        hidden: item.isHidden === true || isStbDepositor(item.name),
        origin: typeof item.origin === 'string' ? item.origin : undefined,
        product: yearn ? (v3 ? 'single' : factory ? 'lp' : 'legacy') : 'other',
        strategy: v3 && item.kind !== 'Multi Strategy',
        category: typeof item.category === 'string' ? item.category : undefined,
        tvlUsd: typeof item.tvl === 'number' && Number.isFinite(item.tvl) && item.tvl >= 0 ? item.tvl : undefined
      }
    ]
  })
  return Array.from(new Map(choices.map((vault) => [key(vault), vault])).values()).sort(
    (a, b) => Number(a.retired) - Number(b.retired) || a.name.localeCompare(b.name)
  )
}

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

export function filterVisibleWalletVaults<T extends TWalletCandidate & { name?: string }>(
  vaults: T[],
  hiddenTokens: TWalletCandidate[]
): T[] {
  const hidden = new Set(hiddenTokens.map(key))
  return vaults.filter((vault) => !hidden.has(key(vault)) && !isStbDepositor(vault.name))
}

/** Only synchronous V3 allocator candidates on this app's supported networks. */
export function parseYearnAllocators(payload: unknown, { includeHidden = false } = {}): TVaultChoice[] {
  if (!Array.isArray(payload)) throw new Error('The Yearn vault list returned an invalid response.')
  return payload
    .flatMap((value): TVaultChoice[] => {
      const item = record(value)
      if (
        item.origin !== 'yearn' ||
        item.kind !== 'Multi Strategy' ||
        (!includeHidden && item.isHidden === true) ||
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
  owner: Address,
  factory = false
): Promise<{ vault?: TVaultChoice; unreadable: boolean }> {
  const address = candidate.address
  try {
    const [asset, balance, conversion, decimals, name, symbol] = await client.multicall({
      allowFailure: true,
      contracts: [
        factory
          ? { address, abi: vaultAbi, functionName: 'token' }
          : { address, abi: erc4626Abi, functionName: 'asset' },
        { address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] },
        factory
          ? { address, abi: vaultAbi, functionName: 'pricePerShare' }
          : { address, abi: erc4626Abi, functionName: 'convertToAssets', args: [0n] },
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
        factory,
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
  signal?: AbortSignal,
  factoryVaults: TVaultChoice[] = []
) {
  const bounded = candidates.slice(0, 500)
  const factories = new Set(factoryVaults.filter((vault) => vault.factory).map(key))
  const batches = Array.from({ length: Math.ceil(bounded.length / 8) }, (_, i) => bounded.slice(i * 8, i * 8 + 8))
  const results = await batches.reduce(
    async (previous, batch) => {
      const collected = await previous
      signal?.throwIfAborted()
      const next = await Promise.all(
        batch.map((candidate) => {
          const client = getClient(candidate.chainId)
          return client
            ? inspectWalletCandidate(client, candidate, owner, factories.has(key(candidate)))
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
