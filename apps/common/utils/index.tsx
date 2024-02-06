import {formatUnits, parseUnits} from 'viem';
import {formatPercent, toAddress, toBigInt, toNormalizedValue} from '@builtbymom/web3/utils';
import {
	LPYCRV_TOKEN_ADDRESS,
	LPYCRV_V2_TOKEN_ADDRESS,
	YCRV_CURVE_POOL_ADDRESS,
	YVBOOST_TOKEN_ADDRESS,
	YVECRV_TOKEN_ADDRESS
} from '@yearn-finance/web-lib/utils/constants';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress, TDict} from '@builtbymom/web3/types';

export function max(input: bigint, balance: bigint): bigint {
	if (input > balance) {
		return balance;
	}
	return input;
}

export function getVaultAPR(vaults: TDict<TYDaemonVault | undefined>, vaultAddress: string): string {
	if (!vaults?.[toAddress(vaultAddress)]) {
		return '';
	}

	if (toAddress(vaultAddress) === YVECRV_TOKEN_ADDRESS || toAddress(vaultAddress) === YVBOOST_TOKEN_ADDRESS) {
		return `APY ${formatPercent(0)}`;
	}

	if (vaults?.[toAddress(vaultAddress)]?.apr?.netAPR) {
		return `APY ${formatPercent((vaults?.[toAddress(vaultAddress)]?.apr?.netAPR || 0) * 100, 2, 2, 500)}`;
	}
	return `APY ${formatPercent(0)}`;
}

export function getAmountWithSlippage(from: string, to: string, value: bigint, slippage: number): number {
	const hasLP =
		toAddress(from) === LPYCRV_TOKEN_ADDRESS ||
		toAddress(to) === LPYCRV_TOKEN_ADDRESS ||
		toAddress(from) === LPYCRV_V2_TOKEN_ADDRESS ||
		toAddress(to) === LPYCRV_V2_TOKEN_ADDRESS;
	const isDirectDeposit =
		toAddress(from) === YCRV_CURVE_POOL_ADDRESS ||
		toAddress(to) === LPYCRV_TOKEN_ADDRESS ||
		toAddress(to) === LPYCRV_V2_TOKEN_ADDRESS;

	if (hasLP && !isDirectDeposit) {
		const minAmountStr = Number(formatUnits(toBigInt(value), 18));
		const minAmountWithSlippage = parseUnits((minAmountStr * (1 - slippage / 100)).toFixed(18) as `${number}`, 18);
		return toNormalizedValue(toBigInt(minAmountWithSlippage), 18);
	}
	return toNormalizedValue(value, 18);
}

export function getVaultName(vault: TYDaemonVault): string {
	const baseName = vault.name;
	if (baseName.includes(' yVault')) {
		return baseName.replace(' yVault', '');
	}
	return baseName;
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

/* 🔵 - Yearn Finance ******************************************************
 ** allowanceKey is used to access the unique allowance key matching one
 ** token with one spender
 **************************************************************************/
export function allowanceKey(chainID: number, token: TAddress, spender: TAddress, owner: TAddress): string {
	return `${chainID}_${token}_${spender}_${owner}`;
}
