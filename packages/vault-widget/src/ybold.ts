import type { Address } from 'viem'

export const YBOLD_CHAIN_ID = 1
export const BOLD_ADDRESS = '0x6440f144b7e50D6a8439336510312d2F54beB01D' satisfies Address
export const YBOLD_VAULT_ADDRESS = '0x9F4330700a36B29952869fac9b33f45EEdd8A3d8' satisfies Address
export const YBOLD_STAKING_ADDRESS = '0x23346B04a7f55b8760E5860AA5A77383D63491cD' satisfies Address
export const YBOLD_ZAPPER_ADDRESS = '0xe7099092533a3fb693bb123cd96b8e53b4d83c58' satisfies Address
export const YEARN_YBOLD_VAULT_URL = `https://yearn.fi/v3/${YBOLD_CHAIN_ID}/${YBOLD_VAULT_ADDRESS}`
