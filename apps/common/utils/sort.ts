import {toNormalizedBN} from '@lib/utils';

import type {TSortDirection} from '@lib/types';

export const stringSort = ({a, b, sortDirection}: {a: string; b: string; sortDirection: TSortDirection}): number =>
	sortDirection === 'desc' ? a.localeCompare(b) : b.localeCompare(a);

export const numberSort = ({a, b, sortDirection}: {a?: number; b?: number; sortDirection: TSortDirection}): number =>
	sortDirection === 'desc' ? (b ?? 0) - (a ?? 0) : (a ?? 0) - (b ?? 0);

export const bigNumberSort = ({a, b, sortDirection}: {a: bigint; b: bigint; sortDirection: TSortDirection}): number =>
	Number(toNormalizedBN(sortDirection === 'desc' ? b - a : a - b, 18).normalized);
