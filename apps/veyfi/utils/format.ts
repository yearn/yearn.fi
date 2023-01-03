import {ethers} from 'ethers';

import type {TAmount, TFormattedAmount, TRaw, TUnit} from '@veYFI/types';

export const toRaw = (amount: TUnit, decimals: number): TRaw => {
	return ethers.utils.parseUnits(amount || '0', decimals).toString();
};

export const toUnit = (amount: TRaw | undefined, decimals: number): TUnit => {
	return ethers.utils.formatUnits(amount || '0', decimals);
};

export const formatAmount = (amount: TAmount, decimals: number): TFormattedAmount =>
	asAmount(Number(amount), decimals, decimals);

function asAmount(amount: number, minimumFractionDigits = 2, maximumFractionDigits = 2): string {
	if (maximumFractionDigits < minimumFractionDigits) {
		maximumFractionDigits = minimumFractionDigits;
	}
	return new Intl.NumberFormat(['en-US'], {minimumFractionDigits, maximumFractionDigits}).format(amount);
}
