export const BRIBE_CATEGORIES = ['claimable', 'all'] as const;
export type TBribeListHeroCategory = typeof BRIBE_CATEGORIES[number];

export const BRIBE_OFFER_CATEGORIES = ['standard', 'factory', 'all'] as const;
export type TBribeOfferListHeroCategory = typeof BRIBE_CATEGORIES[number];
