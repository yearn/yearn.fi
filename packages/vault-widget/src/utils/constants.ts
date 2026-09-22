import { getWrappedNativeAddress } from '@yearn/chains'
import type { TAddress } from '@yearn/vault-widget/types'
import { getAddress, maxUint256, zeroAddress } from 'viem'

const address = (value: string): TAddress => getAddress(value)

export const ZERO_ADDRESS = zeroAddress
export const ETH_TOKEN_ADDRESS = address('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE')
export const WETH_TOKEN_ADDRESS = address(getWrappedNativeAddress(1)!)
export const WFTM_TOKEN_ADDRESS = address(getWrappedNativeAddress(250)!)
export const OPT_WETH_TOKEN_ADDRESS = address(getWrappedNativeAddress(10)!)
export const BASE_WETH_TOKEN_ADDRESS = address(getWrappedNativeAddress(8453)!)
export const ARB_WETH_TOKEN_ADDRESS = address(getWrappedNativeAddress(42161)!)
export const ROBINHOOD_ETH_TOKEN_ADDRESS = address(getWrappedNativeAddress(4663)!)

export const ZAP_ETH_WETH_CONTRACT = address('0xd1791428c38e25d459d5b01fb25e942d4ad83a25')
export const ZAP_FTM_WFTM_CONTRACT = address('0xfCE6CbeF3867102da383465cc237B49fF4B9d48F')
export const ZAP_ETH_WETH_OPT_CONTRACT = address('0xDeAFc27aC8f977E6973d671E43cBfd2573021d9e')
export const MAX_UINT_256 = maxUint256
