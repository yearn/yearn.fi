import {ethers} from 'ethers';

import type {TRaw, TUnit} from '@veYFI/types';

export const toRaw = (amount: TUnit, decimals: number): TRaw => {
	return ethers.utils.parseUnits(amount || '0', decimals).toString();
};
