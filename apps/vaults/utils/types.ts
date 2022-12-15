import {BRIBE_CATEGORIES} from '@yBribe/utils/types';

import type {TBribeListHeroCategory} from '@yBribe/utils/types';

const VAULT_CATEGORIES = ['Curve Vaults', 'Balancer Vaults', 'Stables Vaults', 'Crypto Vaults', 'Holdings', 'Migrations', 'All Vaults', 'Featured Vaults'] as const;

export type TVaultListHeroCategory = typeof VAULT_CATEGORIES[number];

export function isValidCategory<T extends string>(input: string): input is T {
	return VAULT_CATEGORIES.includes(input as TVaultListHeroCategory) || BRIBE_CATEGORIES.includes(input as TBribeListHeroCategory);
}

export type TMigratableVault = {
    name: string;
    address: string;
}
