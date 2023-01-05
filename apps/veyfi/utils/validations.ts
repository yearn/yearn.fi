import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {BN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TValidationResponse = {
    isValid?: boolean;
    error?: string;
}

export type TValidateAllowanceProps = {
    tokenAddress: TAddress;
    spenderAddress: TAddress;
    allowances: TDict<BigNumber>;
    amount: BigNumber;
}

export function validateAllowance(props: TValidateAllowanceProps): TValidationResponse {
	const {tokenAddress, spenderAddress, allowances, amount} = props;
  
	// TODO: return valid when is native token
  
	const allowance = allowances[allowanceKey(tokenAddress, spenderAddress)];
	const isApproved = BN(allowance).gte(amount);
  
	return {isValid: isApproved};
}

export type TValidateAmountProps = {
    amount: string | number;
    balance?: string | number;
    minAmountAllowed?: string | number;
    maxAmountAllowed?: string | number;
	shouldDisplayMin?: boolean;
  }
  
export function validateAmount(props: TValidateAmountProps): TValidationResponse {
	const {amount, balance, minAmountAllowed, maxAmountAllowed, shouldDisplayMin} = props;
	const amountNumber = Number(amount);
	
	if (amountNumber === 0) {
		return {};
	}
  
	if (amountNumber < 0) {
		return {error: 'Invalid amount'};
	}
  
	if (maxAmountAllowed !== undefined && amountNumber > Number(maxAmountAllowed)) {
		return {error: 'Exceeded max amount'};
	}
  
	if (minAmountAllowed !== undefined && amountNumber < Number(minAmountAllowed)) {
		return {error: `Amount under minimum allowed ${shouldDisplayMin && minAmountAllowed !== undefined  ? `(min ${minAmountAllowed})` : ''}`};
	}
  
	if (balance !== undefined && amountNumber > Number(balance)) {
		return {error: `Insufficient balance ${shouldDisplayMin && minAmountAllowed !== undefined  ? `(min ${minAmountAllowed})` : ''}`};
	}
  
	return {isValid: true};
}
