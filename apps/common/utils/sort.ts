import type {TSortDirection} from '@common/types/types';

export const stringSort = ({a, b, sortDirection}: {a: string; b: string; sortDirection: TSortDirection}): number => (
	sortDirection === 'desc' ? a.localeCompare(b) : b.localeCompare(a)
);
