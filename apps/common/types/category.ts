const BRIBE_CATEGORIES = ['claimable', 'all'] as const;
export type TBribeListHeroCategory = (typeof BRIBE_CATEGORIES)[number];

const BRIBE_OFFER_CATEGORIES = ['standard', 'factory', 'all'] as const;
export type TBribeOfferListHeroCategory = (typeof BRIBE_OFFER_CATEGORIES)[number];

const VAULT_CATEGORIES = [
	'All Vaults',
	'Featured Vaults',
	'Popular Vaults',
	'Crypto Vaults',
	'Stables Vaults',
	'Boosted Vaults',
	'Curve Vaults',
	'Prisma Vaults',
	'Balancer Vaults',
	'Velodrome Vaults',
	'Aerodrome Vaults',
	'Holdings',
	'Migrations'
] as const;
export type TVaultListHeroCategory = (typeof VAULT_CATEGORIES)[number];

export function isValidCategory<T extends string>(input: string): input is T {
	return (
		VAULT_CATEGORIES.includes(input as TVaultListHeroCategory) ||
		BRIBE_CATEGORIES.includes(input as TBribeListHeroCategory) ||
		BRIBE_OFFER_CATEGORIES.includes(input as TBribeOfferListHeroCategory)
	);
}
