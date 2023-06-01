import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {BigNumber} from 'ethers';
import type {TSortDirection} from '@common/types/types';

export const stringSort = ({a, b, sortDirection}: {a: string; b: string; sortDirection: TSortDirection}): number => (
	sortDirection === 'desc' ? a.localeCompare(b) : b.localeCompare(a)
);

export const numberSort = ({a, b, sortDirection}: {a?: number; b?: number; sortDirection: TSortDirection}): number => (
	sortDirection === 'desc' ? (b ?? 0) - (a ?? 0) : (a ?? 0) - (b ?? 0)
);

export const bigNumberSort = ({a, b, sortDirection}: {a: BigNumber; b: BigNumber; sortDirection: TSortDirection}): number => (
	Number(toNormalizedBN(sortDirection === 'desc' ? b.sub(a) : a.sub(b)).normalized)
);
