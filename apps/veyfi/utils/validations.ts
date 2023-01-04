import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {BN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TAmount, TRaw} from '@veYFI/types';

export type TValidationResponse = {
    isValid?: boolean;
    error?: string;
}

export type TValidateAllowanceProps = {
    tokenAddress: TAddress;
    spenderAddress: TAddress;
    allowances: TDict<TRaw>;
    amount: TRaw;
}

export function validateAllowance(props: TValidateAllowanceProps): TValidationResponse {
	const {tokenAddress, spenderAddress, allowances, amount} = props;
  
	// TODO: return valid when is native token
  
	const allowance = allowances[allowanceKey(tokenAddress, spenderAddress)];
	const isApproved = BN(allowance).gte(amount);
  
	return {isValid: isApproved};
}

export type TValidateAmountProps = {
    amount: TAmount;
    balance?: TAmount;
    minAmountAllowed?: TAmount;
    maxAmountAllowed?: TAmount;
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
  
	if (maxAmountAllowed && amountNumber > Number(maxAmountAllowed)) {
		return {error: 'Exceeded max amount'};
	}
  
	if (minAmountAllowed && amountNumber < Number(minAmountAllowed)) {
		return {error: `Amount under minimum allowed ${shouldDisplayMin && minAmountAllowed ? `(min ${minAmountAllowed})` : ''}`};
	}
  
	if (balance && amountNumber > Number(balance)) {
		return {error: `Insufficient balance ${shouldDisplayMin && minAmountAllowed ? `(min ${minAmountAllowed})` : ''}`};
	}
  
	return {isValid: true};
}
