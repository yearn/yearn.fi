import {ethers} from 'ethers';
import {ZAP_ETH_WETH_CONTRACT, ZAP_FTM_WFTM_CONTRACT} from '@yearn-finance/web-lib/utils/constants';

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

export function getEthZapperContract(chainID: number): string {
	switch (chainID) {
	case 1:
		return ZAP_ETH_WETH_CONTRACT;
	case 10:
		return ethers.constants.AddressZero;
	case 250:
		return ZAP_FTM_WFTM_CONTRACT;
	case 42161:
		return ethers.constants.AddressZero;
	default:
		return ethers.constants.AddressZero;
	}
}