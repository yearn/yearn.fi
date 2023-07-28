import {mainnet} from 'wagmi';
import {arbitrum, fantom, optimism} from '@wagmi/chains';
import {localhost} from '@yearn-finance/web-lib/utils/wagmi/networks';

export const DEFAULT_SLIPPAGE = 0.5;

export const SUPPORTED_CHAINS = [
	mainnet,
	optimism,
	fantom,
	arbitrum,
	localhost
];
