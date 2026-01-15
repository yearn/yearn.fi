import { AGGREGATE3_ABI } from '@lib/contracts/abi/aggregate.abi'
import type { DependencyList } from 'react'
import { erc20Abi, type MulticallParameters } from 'viem'
import type { Connector } from 'wagmi'
import { multicall } from 'wagmi/actions'
import type { TAddress } from '../types/address'
import type { TChainTokens, TDefaultStatus, TDict, TNDict, TToken } from '../types/mixed'
import { ETH_TOKEN_ADDRESS, MULTICALL3_ADDRESS } from '../utils/constants'
import { decodeAsBigInt, decodeAsNumber, decodeAsString } from '../utils/decoder'
import { toNormalizedBN } from '../utils/format'
import { toAddress } from '../utils/tools.address'
import { isEthAddress, isZeroAddress } from '../utils/tools.is'
import { retrieveConfig } from '../utils/wagmi'
import { getNetwork } from '../utils/wagmi/utils'

/*******************************************************************************
 ** Request, Response and helpers for the useBalances hook.
 ******************************************************************************/
export type TUseBalancesTokens = {
  address: TAddress
  chainID: number
  decimals?: number
  name?: string
  symbol?: string
  for?: string
}
export type TUseBalancesReq = {
  key?: string | number
  tokens: TUseBalancesTokens[]
  priorityChainID?: number
  enabledChainIds?: number[] | null
  effectDependencies?: DependencyList
  provider?: Connector
}

export type TChainStatus = {
  chainLoadingStatus: TNDict<boolean>
  chainSuccessStatus: TNDict<boolean>
  chainErrorStatus: TNDict<boolean>
}

export type TUseBalancesRes = {
  data: TChainTokens
  onUpdate: (shouldForceFetch?: boolean) => Promise<TChainTokens>
  onUpdateSome: (token: TUseBalancesTokens[], shouldForceFetch?: boolean) => Promise<TChainTokens>
  error?: Error
  status: 'error' | 'loading' | 'success' | 'unknown'
} & Omit<TDefaultStatus, 'isFetched' | 'isRefetching' | 'isFetching'> &
  TChainStatus

type TUpdates = TDict<TToken & { lastUpdate: number; owner: TAddress }>
const TOKEN_UPDATE: TUpdates = {}

export async function performCall(
  chainID: number,
  chunckCalls: MulticallParameters['contracts'],
  tokens: TUseBalancesTokens[],
  ownerAddress: TAddress
): Promise<[TDict<TToken>, Error | undefined]> {
  type TMulticallResult =
    | { error?: undefined; result: never; status: 'success' }
    | { error: Error; result?: undefined; status: 'failure' }

  const multicallResult = await (async (): Promise<{ results: TMulticallResult[]; error?: Error }> => {
    try {
      const results = await multicall(retrieveConfig(), {
        contracts: chunckCalls as never[],
        chainId: chainID
      })
      return { results }
    } catch (error) {
      console.error(`Failed to trigger multicall on chain ${chainID}`, error)
      return { results: [], error: error as Error }
    }
  })()

  if (multicallResult.error) {
    return [{}, multicallResult.error]
  }

  const results = multicallResult.results

  const _data: TDict<TToken> = {}
  const hasOwnerAddress = Boolean(ownerAddress) && !isZeroAddress(ownerAddress)
  const tokensAsObject: TDict<TUseBalancesTokens> = {}
  for (const token of tokens) {
    tokensAsObject[toAddress(token.address)] = token
  }

  const callAndResult = chunckCalls.map((call, i) => ({
    call,
    result: results[i]
  }))

  for (const { call, result } of callAndResult) {
    const element =
      tokensAsObject[toAddress(call.address)] ??
      (call.functionName === 'getEthBalance' ? tokensAsObject[toAddress(ETH_TOKEN_ADDRESS)] : null)
    if (!element) {
      continue
    }

    const { address, decimals: injectedDecimals, name: injectedName, symbol: injectedSymbol } = element
    if (!_data[toAddress(address)]) {
      _data[toAddress(address)] = {
        address: address,
        name: injectedName || '',
        symbol: injectedSymbol || '',
        decimals: injectedDecimals || 0,
        chainID: chainID,
        balance: toNormalizedBN(0n, injectedDecimals || 0),
        value: 0
      }
    }
    const decimals = _data[toAddress(address)].decimals || injectedDecimals || 0
    const symbol = _data[toAddress(address)].symbol || injectedSymbol || ''
    const name = _data[toAddress(address)].name || injectedName || ''

    if (call.functionName === 'name') {
      if (name === undefined || name === '') {
        if (isEthAddress(address)) {
          _data[toAddress(address)].name = getNetwork(chainID).nativeCurrency.name
        } else {
          _data[toAddress(address)].name = decodeAsString(result) || name
        }
      }
    } else if (call.functionName === 'symbol') {
      if (symbol === undefined || symbol === '') {
        if (isEthAddress(address)) {
          _data[toAddress(address)].name = getNetwork(chainID).nativeCurrency.symbol
        } else {
          _data[toAddress(address)].symbol = decodeAsString(result) || symbol
        }
      }
    } else if (call.functionName === 'decimals') {
      if (decimals === undefined || decimals === 0) {
        if (isEthAddress(address)) {
          _data[toAddress(address)].decimals = getNetwork(chainID).nativeCurrency.decimals
        } else {
          _data[toAddress(address)].decimals = decodeAsNumber(result) || decimals
        }
      }
    } else if (call.functionName === 'balanceOf' && hasOwnerAddress) {
      const balanceOf = decodeAsBigInt(result)
      _data[toAddress(address)].balance = toNormalizedBN(balanceOf, decimals)
    } else if (call.functionName === 'getEthBalance' && hasOwnerAddress) {
      const balanceOf = decodeAsBigInt(result)
      _data[toAddress(address)].balance = toNormalizedBN(balanceOf, decimals)
    }

    if (_data[toAddress(address)].decimals === 0) {
      _data[toAddress(address)].decimals = 18
    }

    TOKEN_UPDATE[`${chainID}/${toAddress(address)}`] = {
      ..._data[toAddress(address)],
      owner: toAddress(ownerAddress),
      lastUpdate: Date.now()
    }
  }

  return [_data, undefined]
}

export async function getBalances(
  chainID: number,
  address: TAddress | undefined,
  tokens: TUseBalancesTokens[],
  shouldForceFetch = false
): Promise<[TDict<TToken>, Error | undefined]> {
  const ownerAddress = address

  const cachedResults: TDict<TToken> = {}
  for (const element of tokens) {
    const tokenUpdateInfo = TOKEN_UPDATE[`${chainID}/${toAddress(element.address)}`]
    if (tokenUpdateInfo?.lastUpdate && Date.now() - tokenUpdateInfo?.lastUpdate < 60_000 && !shouldForceFetch) {
      if (toAddress(tokenUpdateInfo.owner) === toAddress(ownerAddress)) {
        cachedResults[toAddress(element.address)] = tokenUpdateInfo
      }
    }
  }

  const calls: MulticallParameters['contracts'][number][] = []

  for (const element of tokens) {
    const { address: token } = element

    if (cachedResults[toAddress(token)]) {
      continue
    }

    if (isEthAddress(token)) {
      const network = getNetwork(chainID)
      const multicall3Contract = {
        address: network.contracts.multicall3?.address || MULTICALL3_ADDRESS,
        abi: AGGREGATE3_ABI
      }
      const baseContract = { address: ETH_TOKEN_ADDRESS, abi: erc20Abi }
      if (element.decimals === undefined || element.decimals === 0) {
        calls.push({ ...baseContract, functionName: 'decimals' } as never)
      }
      if (element.symbol === undefined || element.symbol === '') {
        calls.push({ ...baseContract, functionName: 'symbol' } as never)
      }
      if (element.name === undefined || element.name === '') {
        calls.push({ ...baseContract, functionName: 'name' } as never)
      }
      if (ownerAddress) {
        calls.push({
          ...multicall3Contract,
          functionName: 'getEthBalance',
          args: [ownerAddress]
        } as never)
      }
    } else {
      const baseContract = { address: token, abi: erc20Abi }
      if (element.decimals === undefined || element.decimals === 0) {
        calls.push({ ...baseContract, functionName: 'decimals' } as never)
      }
      if (element.symbol === undefined || element.symbol === '') {
        calls.push({ ...baseContract, functionName: 'symbol' } as never)
      }
      if (element.name === undefined || element.name === '') {
        calls.push({ ...baseContract, functionName: 'name' } as never)
      }
      if (ownerAddress) {
        calls.push({ ...baseContract, functionName: 'balanceOf', args: [ownerAddress] } as never)
      }
    }
  }

  try {
    const [callResult] = await performCall(chainID, calls, tokens, toAddress(ownerAddress))
    const result = { ...cachedResults, ...callResult }
    return [result, undefined]
  } catch (_error) {
    console.error(_error)
    return [cachedResults, _error as Error]
  }
}
