export function getToastMessage({vaultChainName, chainName}: {vaultChainName?: string, chainName?: string}): string {
	if (vaultChainName && chainName) {
		return `Please note, this Vault is on ${vaultChainName}. You're currently connected to ${chainName}.`;
	}

	if (vaultChainName && !chainName) {
		return `Please note, this Vault is on ${vaultChainName} and you're currently connected to a different network.`;
	}

	if (!vaultChainName && chainName) {
		return `Please note, you're currently connected to ${chainName} and this Vault is on a different network.`;
	}

	return 'Please note, you\'re currently connected to a different network than this Vault.';
}
