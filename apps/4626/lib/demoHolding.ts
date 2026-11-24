import type { Address } from 'viem'

export const DEMO_HOLDING = {
  chainId: 1,
  address: '0x696d02Db93291651ED510704c9b286841d506987' as Address
}
export const DEMO_FACTORY = {
  chainId: 1,
  address: '0x5B8C556B8b2a78696F0B9B830B3d67623122E270' as Address,
  asset: '0x06325440D014e39736583c165C2963BA99fAf14E' as Address
}
export const DEMO_CROSS_CHAIN_ASSET = {
  chainId: 8453,
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
}
export const isDemoToken = (chainId: number, address: string) =>
  (chainId === DEMO_CROSS_CHAIN_ASSET.chainId &&
    address.toLowerCase() === DEMO_CROSS_CHAIN_ASSET.address.toLowerCase()) ||
  (chainId === 1 &&
    [DEMO_HOLDING.address, DEMO_FACTORY.address, DEMO_FACTORY.asset, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'].some(
      (token) => token.toLowerCase() === address.toLowerCase()
    ))

export const isDemoHolding = (chainId: number, address: string) =>
  [DEMO_HOLDING, DEMO_FACTORY].some(
    (holding) => chainId === holding.chainId && address.toLowerCase() === holding.address.toLowerCase()
  )
