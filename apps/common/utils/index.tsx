import {request} from 'graphql-request';
import {formatUnits, parseUnits} from 'viem';
import {captureException} from '@sentry/nextjs';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatPercent} from '@yearn-finance/web-lib/utils/format.number';

import type {GraphQLResponse} from 'graphql-request/build/esm/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export function max(input: bigint, balance: bigint): bigint {
	if (input > balance) {
		return balance;
	}
	return input;
}

export function getVaultAPY(vaults: TDict<TYDaemonVault | undefined>, vaultAddress: string): string {
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

export function getVaultRawAPY(vaults: TDict<TYDaemonVault | undefined>, vaultAddress: string): number {
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

export function getAmountWithSlippage(from: string, to: string, value: bigint, slippage: number): number {
	const hasLP = (toAddress(from) === LPYCRV_TOKEN_ADDRESS|| toAddress(to) === LPYCRV_TOKEN_ADDRESS);
	const isDirectDeposit = (toAddress(from) === YCRV_CURVE_POOL_ADDRESS || toAddress(to) === LPYCRV_TOKEN_ADDRESS);

	if (hasLP && !isDirectDeposit) {
		const minAmountStr = Number(formatUnits(toBigInt(value), 18));
		const minAmountWithSlippage = parseUnits(((minAmountStr * (1 - (slippage / 100))).toFixed(18) as `${number}`), 18);
		return formatToNormalizedValue(toBigInt(minAmountWithSlippage), 18);
	}
	return formatToNormalizedValue(value, 18);
}

export function getVaultName(vault: TYDaemonVault): string {
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


export function formatDateShort(value: number): string {
	let locale = 'fr-FR';
	if (typeof(navigator) !== 'undefined') {
		locale = navigator.language || 'fr-FR';
	}

	return (new Intl.DateTimeFormat([locale, 'en-US'], {year: 'numeric', month: 'short', day: '2-digit'}).format(value));
}

/* 🔵 - Yearn Finance **************************************************************************
**	Returns an object composed of each element of an array, using one of the elements
**  properties as its key
**********************************************************************************************/
export const keyBy = <T1, T2 extends keyof T1 & string>(array: T1[], key: T2): TDict<T1 | undefined> =>
	(array || []).reduce((r, x): TDict<T1> => ({...r, [x[key] as string]: x}), {});

export async function hash(message: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-512', msgUint8); // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
	const hashHex = hashArray.map((b): string => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
	return `0x${hashHex}`;
}

export function handleSettle<T>(data: PromiseSettledResult<unknown>, fallback: T): T {
	if (data.status !== 'fulfilled') {
		console.error(data.reason);
		captureException(data.reason);
		return fallback;
	}
	return data.value as T;
}
