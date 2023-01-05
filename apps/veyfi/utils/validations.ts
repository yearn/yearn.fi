import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {BN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {toBN} from '@yearn-finance/web-lib/utils/to';

import type {BigNumberish} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TWeeks} from '@yearn-finance/web-lib/utils/time';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TNormalizedBN} from '@common/types/types';
import type {TRaw} from '@veYFI/types';

export type TValidationResponse = {
    isValid?: boolean;
    error?: string;
}

export type TValidateAllowanceProps = {
    tokenAddress: TAddress;
    spenderAddress: TAddress;
    allowances: TDict<TRaw>;
    amount: BigNumberish;
}

export function validateAllowance(props: TValidateAllowanceProps): TValidationResponse {
	const {tokenAddress, spenderAddress, allowances, amount} = props;
  
	// TODO: return valid when is native token
  
	const allowance = allowances[allowanceKey(tokenAddress, spenderAddress)];
	const isApproved = BN(allowance).gte(amount);
  
	return {isValid: isApproved};
}

export type TValidateAmountProps = {
    amount: TNormalizedBN;
    balance?: TNormalizedBN;
    minAmountAllowed?: TNormalizedBN;
    maxAmountAllowed?: TNormalizedBN;
	shouldDisplayMin?: boolean;
  }
  
export function validateAmount(props: TValidateAmountProps): TValidationResponse {
	const {amount, balance, minAmountAllowed, maxAmountAllowed, shouldDisplayMin} = props;

	const amountBN = toBN(amount.raw);
	if (amountBN.isZero()) {
		return {};
	}
  
	if (amountBN.isNegative()) {
		return {error: 'Invalid amount'};
	}
  
	const	maxAmountAllowedBN = toBN(maxAmountAllowed?.raw);
	if (maxAmountAllowedBN.gt(0) && amountBN.gt(maxAmountAllowedBN)) {
		return {error: 'Exceeded max amount'};
	}
  
	const	minAmountAllowedBN = toBN(minAmountAllowed?.raw);
	if (minAmountAllowedBN.gt(0) && amountBN.lt(minAmountAllowedBN)) {
		return {error: `Amount under minimum allowed ${shouldDisplayMin && minAmountAllowed ? `(min ${minAmountAllowed.normalized})` : ''}`};
	}
  
	const	balanceBN = toBN(balance?.raw);
	if (balanceBN.gt(0) && amountBN.gt(balanceBN)) {
		return {error: `Exceeded balance ${shouldDisplayMin && minAmountAllowed ? `(max ${formatAmount(Number(balance?.normalized), 6, 6)})` : ''}`};
	}
  
	return {isValid: true};
}


export type TValidateTimeProps = {
    amount: TWeeks;
    minAmountAllowed?: TWeeks;
    maxAmountAllowed?: TWeeks;
	shouldDisplayMin?: boolean;
  }

export function validateTime(props: TValidateTimeProps): TValidationResponse {
	const {amount, minAmountAllowed, maxAmountAllowed, shouldDisplayMin} = props;
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

	return {isValid: true};
}
