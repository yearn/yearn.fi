import type { TAddress } from '@lib/types'
import {
  ARB_WETH_TOKEN_ADDRESS,
  OPT_WETH_TOKEN_ADDRESS,
  WETH_TOKEN_ADDRESS,
  WFTM_TOKEN_ADDRESS,
  ZAP_ETH_WETH_CONTRACT,
  ZAP_ETH_WETH_OPT_CONTRACT,
  ZAP_FTM_WFTM_CONTRACT,
  ZERO_ADDRESS
} from '@lib/utils/constants'
import { zeroAddress } from 'viem'

export function getMessariSubgraphEndpoint(chainID: number): string {
  switch (chainID) {
    case 1:
      return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum'
    case 250:
      return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-fantom'
    case 42161:
      return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-arbitrum'
    //testnets
    case 1337:
      return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum'
    default:
      return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum'
  }
}

export function getEthZapperContract(chainID: number): TAddress {
  switch (chainID) {
    case 1:
      return ZAP_ETH_WETH_CONTRACT
    case 10:
      return ZAP_ETH_WETH_OPT_CONTRACT
    case 250:
      return ZAP_FTM_WFTM_CONTRACT
    case 42161:
      return ZERO_ADDRESS
    //testnets
    case 1337:
      return ZAP_ETH_WETH_CONTRACT
    default:
      return ZERO_ADDRESS
  }
}

export function getNativeTokenWrapperContract(chainID: number): TAddress {
  switch (chainID) {
    case 1:
      return WETH_TOKEN_ADDRESS
    case 10:
      return OPT_WETH_TOKEN_ADDRESS
    case 250:
      return WFTM_TOKEN_ADDRESS
    case 42161:
      return ARB_WETH_TOKEN_ADDRESS
    //testnets
    case 1337:
      return WETH_TOKEN_ADDRESS
    default:
      return ZERO_ADDRESS
  }
}

export function getNativeTokenWrapperName(chainID: number): string {
  switch (chainID) {
    case 1:
      return 'ETH'
    case 10:
      return 'OPT'
    case 250:
      return 'FTM'
    case 42161:
      return 'ARB'
    // testnets
    case 1337:
      return 'ETH'
    default:
      return 'ETH'
  }
}

export function truncateHexTx(hash: string | undefined, size: number): string {
  if (hash !== undefined) {
    if (size === 0) {
      return hash
    }
    if (hash.length <= size * 2 + 4) {
      return hash
    }
    return `0x${hash.slice(2, size + 2)}...${hash.slice(-size)}`
  }
  if (size === 0) {
    return zeroAddress
  }
  return `0x${zeroAddress.slice(2, size)}...${zeroAddress.slice(-size)}`
}
