import {
  PENDLE_MARKET_VAULT_ADDRESSES,
  SPECTRA_MARKET_VAULT_ADDRESSES,
  VAULT_ADDRESSES
} from '@pages/vaults/constants/addresses'

export type TFixedTermProvider = 'pendle' | 'spectra'

export type TFixedTermMarket = {
  address: string
  provider: TFixedTermProvider
  label: string
  marketUrl: string
}

const SPECTRA_MARKET_URL = 'https://app.spectra.finance/fixed-rate'
const PENDLE_MARKET_URL = 'https://app.pendle.finance/trade/markets'
const PENDLE_YSYBOLD_MARKET_URL =
  'https://app.pendle.finance/trade/markets/0x83b2c0b470ff5f2a60d2bf2ae109766e8bb3e862/swap?view=pt&chain=ethereum'

const FIXED_TERM_MARKETS: TFixedTermMarket[] = [
  ...SPECTRA_MARKET_VAULT_ADDRESSES.map(
    (address): TFixedTermMarket => ({
      address,
      provider: 'spectra',
      label: 'Spectra',
      marketUrl: SPECTRA_MARKET_URL
    })
  ),
  ...PENDLE_MARKET_VAULT_ADDRESSES.map(
    (address): TFixedTermMarket => ({
      address,
      provider: 'pendle',
      label: 'Pendle',
      marketUrl: PENDLE_YSYBOLD_MARKET_URL
    })
  ),
  {
    address: VAULT_ADDRESSES.PENDLE_ARB_REWARDS.toLowerCase(),
    provider: 'pendle',
    label: 'Pendle',
    marketUrl: PENDLE_MARKET_URL
  } as TFixedTermMarket
]

export function getFixedTermMarket(address: string): TFixedTermMarket | undefined {
  return getFixedTermMarkets(address)[0]
}

export function getFixedTermMarkets(address: string): TFixedTermMarket[] {
  const normalized = address.toLowerCase()
  return FIXED_TERM_MARKETS.filter((entry) => entry.address === normalized)
}
