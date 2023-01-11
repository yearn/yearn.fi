import {ethers} from 'ethers';
import request from 'graphql-request';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {BigNumber} from 'ethers';
import type {GraphQLResponse} from 'graphql-request/dist/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

export function	max(input: BigNumber, balance: BigNumber): BigNumber {
	if (input.gt(balance)) {
		return balance;
	}
	return input;
}

export function getVaultAPY(vaults: TDict<TYearnVault | undefined>, vaultAddress: string): string {
	if (!vaults?.[toAddress(vaultAddress)]) {
		return '';
	}

	if (toAddress(vaultAddress) === YVECRV_TOKEN_ADDRESS
		|| toAddress(vaultAddress) === YVBOOST_TOKEN_ADDRESS) {
		return `APY ${formatPercent(0)}`;
	}

	if (vaults?.[toAddress(vaultAddress)]?.apy?.net_apy) {
		if ((vaults?.[toAddress(vaultAddress)]?.apy?.net_apy || 0) > 5) {
			return `APY ≧ ${formatPercent(500)}`;
		}
		return `APY ${formatPercent((vaults?.[toAddress(vaultAddress)]?.apy?.net_apy || 0) * 100)}`;
	}

	return `APY ${formatPercent(0)}`;
}

export function getVaultRawAPY(vaults: TDict<TYearnVault | undefined>, vaultAddress: string): number {
	if (!vaults?.[toAddress(vaultAddress)]) {
		return 0;
	}

	if (toAddress(vaultAddress) === YVECRV_TOKEN_ADDRESS
		|| toAddress(vaultAddress) === YVBOOST_TOKEN_ADDRESS) {
		return 0;
	}

	if (vaults?.[toAddress(vaultAddress)]?.apy?.net_apy) {
		return (vaults?.[toAddress(vaultAddress)]?.apy?.net_apy || 0) * 100;
	}

	return 0;
}

export function getAmountWithSlippage(from: string, to: string, value: BigNumber, slippage: number): number {
	const	hasLP = (
		toAddress(from) === LPYCRV_TOKEN_ADDRESS
		|| toAddress(to) === LPYCRV_TOKEN_ADDRESS
	);
	const	isDirectDeposit = (
		toAddress(from) === YCRV_CURVE_POOL_ADDRESS
		|| toAddress(to) === LPYCRV_TOKEN_ADDRESS
	);

	if (hasLP && !isDirectDeposit) {
		const	minAmountStr = Number(ethers.utils.formatUnits(value || ethers.constants.Zero, 18));
		const	minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
		return formatToNormalizedValue(minAmountWithSlippage || ethers.constants.Zero, 18);
	}
	return formatToNormalizedValue(value || ethers.constants.Zero, 18);
}

export function getVaultName(vault: TYearnVault): string {
	const baseName = vault.display_name || vault.name || vault.formated_name || 'unknown';
	if (baseName.includes(' yVault')) {
		return baseName.replace(' yVault', '');
	}
	return baseName;
}

export const graphFetcher = async (args: [string, string]): Promise<GraphQLResponse> => {
	const [url, query] = args;
	return request(url, query);
};

export const formatPercent = (n: number, min = 2, max = 2): string => `${formatAmount(n || 0, min, max)}%`;

export const formatUSD = (n: number, min = 2, max = 2): string => `$ ${formatAmount(n || 0, min, max)}`;
