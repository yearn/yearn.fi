import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'

export const KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID = 1
export const KATANA_VAULT_BRIDGE_DESTINATION_NETWORK_ID = 20

export type KatanaBridgeAssetConfig = {
  sourceChainId: typeof KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID
  sourceTokenAddress: Address
  sourceTokenSymbol: string
  bridgeContractAddress: Address
  katanaAssetAddress: Address
  katanaAssetSymbol: string
}

const KATANA_BRIDGE_ASSET_CONFIGS: KatanaBridgeAssetConfig[] = [
  {
    sourceChainId: KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID,
    sourceTokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    sourceTokenSymbol: 'WETH',
    bridgeContractAddress: '0x2DC70fb75b88d2eB4715bc06E1595E6D97c34DFF',
    katanaAssetAddress: '0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62',
    katanaAssetSymbol: 'WETH'
  },
  {
    sourceChainId: KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID,
    sourceTokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    sourceTokenSymbol: 'WBTC',
    bridgeContractAddress: '0x2C24B57e2CCd1f273045Af6A5f632504C432374F',
    katanaAssetAddress: '0x0913DA6Da4b42f538B445599b46Bb4622342Cf52',
    katanaAssetSymbol: 'WBTC'
  },
  {
    sourceChainId: KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID,
    sourceTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    sourceTokenSymbol: 'USDC',
    bridgeContractAddress: '0x53E82ABbb12638F09d9e624578ccB666217a765e',
    katanaAssetAddress: '0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36',
    katanaAssetSymbol: 'USDC'
  },
  {
    sourceChainId: KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID,
    sourceTokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    sourceTokenSymbol: 'USDT',
    bridgeContractAddress: '0x6d4f9f9f8f0155509ecd6Ac6c544fF27999845CC',
    katanaAssetAddress: '0x2DCa96907fde857dd3D816880A0df407eeB2D2F2',
    katanaAssetSymbol: 'USDT'
  },
  {
    sourceChainId: KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID,
    sourceTokenAddress: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    sourceTokenSymbol: 'USDS',
    bridgeContractAddress: '0x3DD459dE96F9C28e3a343b831cbDC2B93c8C4855',
    katanaAssetAddress: '0x62D6A123E8D19d06d68cf0d2294F9A3A0362c6b3',
    katanaAssetSymbol: 'USDS'
  }
]

const KATANA_BRIDGE_ASSET_CONFIG_BY_ASSET = new Map(
  KATANA_BRIDGE_ASSET_CONFIGS.map((config) => [toAddress(config.katanaAssetAddress).toLowerCase(), config])
)

export function getKatanaBridgeAssetConfig({
  vaultChainId,
  assetAddress
}: {
  vaultChainId: number
  assetAddress?: Address
}): KatanaBridgeAssetConfig | undefined {
  if (vaultChainId !== KATANA_CHAIN_ID || !assetAddress) {
    return undefined
  }

  return KATANA_BRIDGE_ASSET_CONFIG_BY_ASSET.get(toAddress(assetAddress).toLowerCase())
}
