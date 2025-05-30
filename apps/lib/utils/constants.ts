import {toAddress} from './tools.address';

import type {TToken} from '../types';

export const MULTICALL3_ADDRESS = toAddress('0xcA11bde05977b3631167028862bE2a173976CA11');

// Various tokens that are used in the app
export const ZERO_ADDRESS = toAddress('0x0000000000000000000000000000000000000000');
export const YFI_ADDRESS = toAddress('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e');
export const ETH_TOKEN_ADDRESS = toAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
export const WETH_TOKEN_ADDRESS = toAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
export const WFTM_TOKEN_ADDRESS = toAddress('0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83');
export const OPT_WETH_TOKEN_ADDRESS = toAddress('0x4200000000000000000000000000000000000006');
export const BASE_WETH_TOKEN_ADDRESS = toAddress('0x4200000000000000000000000000000000000006');
export const ARB_WETH_TOKEN_ADDRESS = toAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');
export const CRV_TOKEN_ADDRESS = toAddress('0xD533a949740bb3306d119CC777fa900bA034cd52');
export const THREECRV_TOKEN_ADDRESS = toAddress('0x6c3f90f043a72fa612cbac8115ee7e52bde6e490');
export const CVXCRV_TOKEN_ADDRESS = toAddress('0x62b9c7356a2dc64a1969e19c23e4f579f9810aa7');

export const BIG_ZERO = 0n;
export const MAX_UINT_256 = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;

export const DEFAULT_ERC20: TToken = {
	address: ZERO_ADDRESS,
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	balance: {raw: 0n, normalized: 0, display: '0'}
};
