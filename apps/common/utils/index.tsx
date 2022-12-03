import {ethers} from 'ethers';
import request from 'graphql-request';
import axios from 'axios';
import {format, toAddress} from '@yearn-finance/web-lib/utils';
import {LPYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@common/utils/constants';

import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/utils';
import type {TNormalizedBN} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

export function	max(input: BigNumber, balance: BigNumber): BigNumber {
	if (input.gt(balance)) {
		return balance;
	}
	return input;
}

export function allowanceKey(token: unknown, spender: unknown): string {
	return `${toAddress(token as string)}_${toAddress(spender as string)}`;
}

export function	getCounterValue(amount: number | string, price: number): string {
	if (!amount || !price) {
		return ('$0.00');
	}
	const value = (Number(amount) || 0) * (price || 0);
	if (value > 10000) {
		return (`$${format.amount(value, 0, 0)}`);
	}
	return (`$${format.amount(value, 2, 2)}`);
}

export function	getCounterValueRaw(amount: number | string, price: number): string {
	if (!amount || !price) {
		return ('');
	}
	const value = (Number(amount) || 0) * (price || 0);
	if (value > 10000) {
		return (`${format.amount(value, 0, 0)}`);
	}
	return (`${format.amount(value, 2, 2)}`);
}

export function getVaultAPY(vaults: TDict<TYearnVault | undefined>, vaultAddress: string): string {
	if (!vaults?.[toAddress(vaultAddress)]) {
		return '';
	}

	if (toAddress(vaultAddress) === YVECRV_TOKEN_ADDRESS
		|| toAddress(vaultAddress) === YVBOOST_TOKEN_ADDRESS) {
		return `APY ${format.amount(0, 2, 2)}%`;
	}

	if (vaults?.[toAddress(vaultAddress)]?.apy?.net_apy) {
		return `APY ${format.amount((vaults?.[toAddress(vaultAddress)]?.apy?.net_apy || 0) * 100, 2, 2)}%`;
	}

	return `APY ${format.amount(0, 2, 2)}%`;
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
		return format.toNormalizedValue(minAmountWithSlippage || ethers.constants.Zero, 18);
	}
	return format.toNormalizedValue(value || ethers.constants.Zero, 18);
}

export function handleInputChange(
	e: React.ChangeEvent<HTMLInputElement>,
	decimals: number
): TNormalizedBN {
	let		amount = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
	const	amountParts = amount.split('.');
	if (amountParts.length === 2) {
		amount = amountParts[0] + '.' + amountParts[1].slice(0, decimals);
	}
	const	raw = ethers.utils.parseUnits(amount || '0', decimals);
	return ({raw: raw, normalized: amount});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const baseFetcher = async (url: string): Promise<any> => axios.get(url).then((res): any => res.data);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const graphFetcher = async (url: string, query: string): Promise<any> => request(url, query);

export function getVaultName(vault: TYearnVault): string {
	const baseName = vault.display_name || vault.name || vault.formated_name || 'unknown';
	if (baseName.includes(' yVault')) {
		return baseName.replace(' yVault', '');
	}
	return baseName;
}

export function formatWithUnit(amount: number, minimumFractionDigits = 2, maximumFractionDigits = 2): string {
	let		locale = 'fr-FR';
	if (typeof(navigator) !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}
	if (maximumFractionDigits < minimumFractionDigits) {
		maximumFractionDigits = minimumFractionDigits;
	}
	return (new Intl.NumberFormat([locale, 'en-US'], {
		minimumFractionDigits,
		maximumFractionDigits,
		notation: 'compact',
		compactDisplay: 'short',
		unitDisplay: 'short'
	}).format(amount));
}