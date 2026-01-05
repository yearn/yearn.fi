import { SPECTRA_BOOST_VAULT_ADDRESSES, VAULT_ADDRESSES } from '@vaults-v3/constants/addresses'

export type TFixedTermProvider = 'pendle' | 'spectra'

export type TFixedTermMarket = {
  address: string
  provider: TFixedTermProvider
  label: string
  marketUrl: string
}

const SPECTRA_MARKET_URL = 'https://app.spectra.finance/fixed-rate'
const PENDLE_MARKET_URL = 'https://app.pendle.finance/trade/markets'

const FIXED_TERM_MARKETS: TFixedTermMarket[] = [
  ...SPECTRA_BOOST_VAULT_ADDRESSES.map(
    (address): TFixedTermMarket => ({
      address,
      provider: 'spectra',
      label: 'Spectra',
      marketUrl: SPECTRA_MARKET_URL
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
  const normalized = address.toLowerCase()
  return FIXED_TERM_MARKETS.find((entry) => entry.address === normalized)
}
