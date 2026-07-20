import type { TAddress } from '@yearn/vault-widget/types'
import { getAddress, maxUint256, zeroAddress } from 'viem'

const address = (value: string): TAddress => getAddress(value)

export const ZERO_ADDRESS = zeroAddress
export const ETH_TOKEN_ADDRESS = address('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')
export const WETH_TOKEN_ADDRESS = address('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
export const WFTM_TOKEN_ADDRESS = address('0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83')
export const OPT_WETH_TOKEN_ADDRESS = address('0x4200000000000000000000000000000000000006')
export const BASE_WETH_TOKEN_ADDRESS = address('0x4200000000000000000000000000000000000006')
export const ARB_WETH_TOKEN_ADDRESS = address('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1')

export const ZAP_ETH_WETH_CONTRACT = address('0xd1791428c38e25d459d5b01fb25e942d4ad83a25')
export const ZAP_FTM_WFTM_CONTRACT = address('0xfCE6CbeF3867102da383465cc237B49fF4B9d48F')
export const ZAP_ETH_WETH_OPT_CONTRACT = address('0xDeAFc27aC8f977E6973d671E43cBfd2573021d9e')
export const MAX_UINT_256 = maxUint256
