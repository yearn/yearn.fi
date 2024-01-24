import {isAddress} from 'viem';
import {isZero} from '@builtbymom/web3/utils';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';

import type {TAddress, TDict} from '@builtbymom/web3/types';

export type TValidationResponse = {
	isValid?: boolean;
	error?: string;
};

export type TValidateAllowanceProps = {
	ownerAddress: TAddress;
	tokenAddress: TAddress;
	spenderAddress: TAddress;
	chainID: number;
	allowances: TDict<bigint>;
	amount: bigint;
};

export function validateAllowance(props: TValidateAllowanceProps): TValidationResponse {
	const {tokenAddress, spenderAddress, allowances, amount, ownerAddress, chainID} = props;

	if (!tokenAddress || !spenderAddress) {
		return {isValid: false};
	}

	// TODO: return valid when is native token
	const allowance = allowances[allowanceKey(chainID, tokenAddress, spenderAddress, ownerAddress)];
	const isApproved = allowance >= amount;

	return {isValid: isApproved};
}

export type TValidateAmountProps = {
	amount: string | number;
	balance?: string | number;
	minAmountAllowed?: string | number;
	maxAmountAllowed?: string | number;
	shouldDisplayMin?: boolean;
};

export function validateAmount(props: TValidateAmountProps): TValidationResponse {
	const {amount, balance, minAmountAllowed, maxAmountAllowed, shouldDisplayMin} = props;
	const amountNumber = Number(amount);

	if (isZero(amountNumber)) {
		return {};
	}

	if (amountNumber < 0) {
		return {isValid: false, error: 'Invalid amount'};
	}

	if (maxAmountAllowed !== undefined && amountNumber > Number(maxAmountAllowed)) {
		return {isValid: false, error: 'Exceeded max amount'};
	}

	if (minAmountAllowed !== undefined && amountNumber < Number(minAmountAllowed)) {
		return {
			isValid: false,
			error: `Amount under minimum allowed ${
				shouldDisplayMin && minAmountAllowed !== undefined ? `(min ${minAmountAllowed})` : ''
			}`
		};
	}

	if (balance !== undefined && amountNumber > Number(balance)) {
		return {isValid: false, error: 'Insufficient balance'};
	}

	return {isValid: true};
}

export type TValidateNetworkProps = {
	supportedNetwork: number;
	walletNetwork?: number;
};

export type TValidateAddressProps = {
	address?: string;
};

export function validateAddress(props: TValidateAddressProps): TValidationResponse {
	const {address} = props;

	if (!address) {
		return {isValid: false};
	}

	if (!isAddress(address)) {
		return {isValid: false, error: 'Invalid Address'};
	}

	return {isValid: true};
}
