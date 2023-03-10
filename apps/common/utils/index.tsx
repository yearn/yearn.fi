import {ethers} from 'ethers';
import {request} from 'graphql-request';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';

import type {BigNumber} from 'ethers';
import type {GraphQLResponse} from 'graphql-request/build/esm/types';
import type {TDict} from '@yearn-finance/web-lib/types';
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
		return `APY ${formatPercent((vaults?.[toAddress(vaultAddress)]?.apy?.net_apy || 0) * 100, 2, 2, 500)}`;
	}
	return `APY ${formatPercent(0)}`;
}

export function getVaultRawAPY(vaults: TDict<TYearnVault | undefined>, vaultAddress: string): number {
	if (!vaults?.[toAddress(vaultAddress)]) {
		return 0;
	}

	if (toAddress(vaultAddress) === YVECRV_TOKEN_ADDRESS || toAddress(vaultAddress) === YVBOOST_TOKEN_ADDRESS) {
		return 0;
	}

	if (vaults?.[toAddress(vaultAddress)]?.apy?.net_apy) {
		return (vaults?.[toAddress(vaultAddress)]?.apy?.net_apy || 0) * 100;
	}

	return 0;
}

export function getAmountWithSlippage(from: string, to: string, value: BigNumber, slippage: number): number {
	const	hasLP = (toAddress(from) === LPYCRV_TOKEN_ADDRESS|| toAddress(to) === LPYCRV_TOKEN_ADDRESS);
	const	isDirectDeposit = (toAddress(from) === YCRV_CURVE_POOL_ADDRESS || toAddress(to) === LPYCRV_TOKEN_ADDRESS);

	if (hasLP && !isDirectDeposit) {
		const minAmountStr = Number(ethers.utils.formatUnits(formatBN(value), 18));
		const minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
		return formatToNormalizedValue(formatBN(minAmountWithSlippage), 18);
	}
	return formatToNormalizedValue(value, 18);
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


export function	formatDateShort(value: number): string {
	let		locale = 'fr-FR';
	if (typeof(navigator) !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}

	return (new Intl.DateTimeFormat([locale, 'en-US'], {year: 'numeric', month: 'short', day: '2-digit'}).format(value));
}
