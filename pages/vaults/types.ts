const VAULT_CATEGORIES = ['Curve Vaults', 'Balancer Vaults', 'Stables Vaults', 'Crypto Vaults', 'Holdings', 'Migrations', 'All Vaults'] as const;

export type TVaultCategory = typeof VAULT_CATEGORIES[number];

export function isVaultCategory(input: string): input is TVaultCategory {
	return VAULT_CATEGORIES.includes(input as TVaultCategory);
}

export type TMigratableVault = {
    name: string;
    address: string;
}
