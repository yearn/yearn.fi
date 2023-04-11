import {addressZero, toAddress} from '@yearn-finance/web-lib/utils/address';
import {WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS, ZAP_ETH_WETH_CONTRACT, ZAP_FTM_WFTM_CONTRACT} from '@yearn-finance/web-lib/utils/constants';

import type {TAddress} from '@yearn-finance/web-lib/types';

export function getMessariSubgraphEndpoint(chainID: number): string {
	switch (chainID) {
		case 1:
			return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum';
		case 250:
			return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-fantom';
		case 42161:
			return 'https://api.thegraph.com/subgraphs/name/messari/yearn-v2-arbitrum';
		default:
			return ('https://api.thegraph.com/subgraphs/name/messari/yearn-v2-ethereum');
	}
}

export function getEthZapperContract(chainID: number): TAddress {
	switch (chainID) {
		case 1:
			return ZAP_ETH_WETH_CONTRACT;
		case 10:
			return addressZero;
		case 250:
			return ZAP_FTM_WFTM_CONTRACT;
		case 42161:
			return addressZero;
		default:
			return addressZero;
	}
}

export function getNativeTokenWrapperContract(chainID: number): TAddress {
	switch (chainID) {
		case 1:
			return WETH_TOKEN_ADDRESS;
		case 10:
			return toAddress('0x4200000000000000000000000000000000000006'); // TODO: import from web-lib
		case 250:
			return WFTM_TOKEN_ADDRESS;
		case 42161:
			return toAddress('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'); // TODO: import from web-lib
		default:
			return addressZero;
	}
}
