import {useCallback, useMemo, useState} from 'react';
import {useTokenList} from '@builtbymom/web3/contexts/WithTokenList';
import {useChainID} from '@builtbymom/web3/hooks/useChainID';
import {toAddress} from '@builtbymom/web3/utils';
import {getNetwork} from '@builtbymom/web3/utils/wagmi';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useFetchYearnTokens} from '@yearn-finance/web-lib/hooks/useFetchYearnTokens';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import {useBalances} from './useBalances.multichains';

import type {TYChainTokens} from '@yearn-finance/web-lib/types';
import type {TYDaemonToken} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokensSchema';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TDict, TNDict} from '@builtbymom/web3/types';

export function useYearnTokens({
	vaults,
	vaultsMigrations,
	vaultsRetired,
	isLoadingVaultList
}: {
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
}): TUseBalancesTokens[] {
	const yearnTokens = useFetchYearnTokens() as unknown as TNDict<TDict<TYDaemonToken>>;
	const {currentNetworkTokenList} = useTokenList();
	const {safeChainID} = useChainID();
	const [isReady, set_isReady] = useState(false);

	/**************************************************************************
	 ** Define the list of available tokens. This list is retrieved from the
	 ** tokenList context and filtered to only keep the tokens of the current
	 ** network.
	 **************************************************************************/
	const availableTokenListTokens = useMemo((): TUseBalancesTokens[] => {
		const withTokenList = [...Object.values(currentNetworkTokenList)];
		const tokens: TUseBalancesTokens[] = [];
		withTokenList.forEach((token): void => {
			tokens.push({
				address: toAddress(token.address),
				chainID: token.chainID,
				decimals: Number(token.decimals),
				name: token.name,
				symbol: token.symbol
			});
		});

		const {wrappedToken} = getNetwork(safeChainID).contracts;
		if (wrappedToken) {
			tokens.push({
				address: toAddress(ETH_TOKEN_ADDRESS),
				chainID: safeChainID,
				decimals: wrappedToken.decimals,
				name: wrappedToken.coinName,
				symbol: wrappedToken.coinSymbol
			});
		}
		return tokens;
	}, [safeChainID, currentNetworkTokenList]);

	//List available tokens
	const availableTokens = useMemo((): TDict<TUseBalancesTokens> => {
		if (isLoadingVaultList || !yearnTokens) {
			return {};
		}
		const tokens: TDict<TUseBalancesTokens> = {};
		const extraTokens: TUseBalancesTokens[] = [];
		extraTokens.push(
			...[
				{chainID: 1, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'},
				{chainID: 10, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'},
				{chainID: 137, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Matic', symbol: 'POL'},
				{chainID: 250, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Fantom', symbol: 'FTM'},
				{chainID: 8453, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'},
				{chainID: 42161, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH'}
			]
		);

		for (const token of extraTokens) {
			const key = `${token.chainID}/${toAddress(token.address)}`;
			tokens[key] = token;
		}

		Object.values(vaults || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}

			if (vault?.address && !tokens[`${vault.chainID}/${toAddress(vault.address)}`]) {
				const newToken = {
					address: vault.address,
					chainID: vault.chainID,
					symbol: vault.symbol,
					decimals: vault.decimals,
					name: vault.name
				};

				tokens[`${vault.chainID}/${toAddress(vault.address)}`] = newToken;
			} else {
				const existingToken = tokens[`${vault.chainID}/${toAddress(vault.address)}`];
				if (existingToken) {
					if (!existingToken?.name && vault.name) {
						tokens[`${vault.chainID}/${toAddress(vault.address)}`].name = vault.name;
					}
					if (!existingToken?.symbol && vault.symbol) {
						tokens[`${vault.chainID}/${toAddress(vault.address)}`].symbol = vault.symbol;
					}
					if (!existingToken?.decimals && vault.decimals) {
						tokens[`${vault.chainID}/${toAddress(vault.address)}`].decimals = vault.decimals;
					}
				}
			}

			// Add vaults tokens
			if (vault?.token?.address && !tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`]) {
				const newToken = {
					address: vault.token.address,
					chainID: vault.chainID,
					symbol: vault.symbol,
					decimals: vault.decimals,
					name: vault.name
				};

				tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`] = newToken;
			} else {
				const existingToken = tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`];
				if (existingToken) {
					if (!existingToken?.name && vault.name) {
						tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`].name = vault.name;
					}
					if (!existingToken?.symbol && vault.symbol) {
						tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`].symbol = vault.symbol;
					}
					if (!existingToken?.decimals && vault.decimals) {
						tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`].decimals = vault.decimals;
					}
				}
			}

			// Add staking token
			if (vault?.staking?.available && !tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`]) {
				const newToken = {
					address: toAddress(vault?.staking?.address),
					chainID: vault.chainID,
					symbol: vault.symbol,
					decimals: vault.decimals,
					name: vault.name
				};
				tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`] = newToken;
			} else {
				const existingToken = tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`];
				if (existingToken) {
					if (!existingToken?.name && vault.name) {
						tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`].name = vault.name;
					}
					if (!existingToken?.symbol && vault.symbol) {
						tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`].symbol = vault.symbol;
					}
					if (!existingToken?.decimals && vault.decimals) {
						tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`].decimals = vault.decimals;
					}
				}
			}
		});

		for (const [chainID, tokensData] of Object.entries(yearnTokens)) {
			if (tokensData) {
				for (const [address, token] of Object.entries(tokensData)) {
					if (token && !tokens[`${token.chainID}/${toAddress(address)}`]) {
						tokens[`${token.chainID}/${toAddress(address)}`] = {
							address: toAddress(address),
							chainID: Number(chainID),
							decimals: token.decimals,
							name: token.name,
							symbol: token.symbol
						};
					} else {
						const existingToken = tokens[`${token.chainID}/${toAddress(address)}`];
						if (existingToken) {
							if (!existingToken?.name && token.name) {
								tokens[`${token.chainID}/${toAddress(address)}`].name = token.name;
							}
							if (!existingToken?.symbol && token.symbol) {
								tokens[`${token.chainID}/${toAddress(address)}`].symbol = token.symbol;
							}
							if (!existingToken?.decimals && token.decimals) {
								tokens[`${token.chainID}/${toAddress(address)}`].decimals = token.decimals;
							}
						}
					}
				}
			}
		}

		set_isReady(true);
		return tokens;
	}, [isLoadingVaultList, vaults, yearnTokens]);

	//List all vaults with a possible migration
	const migratableTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsMigrations || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({
				address: vault.address,
				chainID: vault.chainID,
				symbol: vault.symbol,
				name: vault.name,
				decimals: vault.decimals
			});
		});
		return tokens;
	}, [vaultsMigrations]);

	//List retried tokens
	const retiredTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsRetired || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({
				address: vault.address,
				chainID: vault.chainID,
				symbol: vault.symbol,
				name: vault.name,
				decimals: vault.decimals
			});
		});
		return tokens;
	}, [vaultsRetired]);

	const allTokens = useMemo((): TUseBalancesTokens[] => {
		if (!isReady) {
			return [];
		}
		const fromAvailableTokens = Object.values(availableTokens);
		const tokens = [...fromAvailableTokens, ...migratableTokens, ...retiredTokens, ...availableTokenListTokens];
		return tokens;
	}, [isReady, availableTokens, migratableTokens, retiredTokens, availableTokenListTokens]);

	/**************************************************************************************************
	 ** The following function can be used to clone the tokens list for the forknet. This is useful
	 ** for debuging purpose and should not be used in production.
	 *************************************************************************************************/
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
	function cloneForForknet(tokens: TUseBalancesTokens[]): TUseBalancesTokens[] {
		const clonedTokens: TUseBalancesTokens[] = [];
		tokens.forEach((token): void => {
			clonedTokens.push({...token});
			if (token.chainID === 1) {
				clonedTokens.push({...token, chainID: 1337});
			}
		});
		return clonedTokens;
	}
	const shouldEnableForknet = false;
	if (shouldEnableForknet) {
		return cloneForForknet(allTokens);
	}

	return allTokens;
}

export function useYearnBalances({
	vaults,
	vaultsMigrations,
	vaultsRetired,
	isLoadingVaultList
}: {
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
}): {
	balances: TYChainTokens;
	isLoadingBalances: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
} {
	const allTokens = useYearnTokens({vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList});
	const {
		data: tokensRaw,
		onUpdate,
		onUpdateSome,
		isLoading
	} = useBalances({
		tokens: allTokens
	});

	const balances = useDeepCompareMemo((): TYChainTokens => {
		const _tokens = {...tokensRaw};
		return _tokens as TYChainTokens;
	}, [tokensRaw]);

	const onRefresh = useCallback(
		async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TYChainTokens> => {
			if (tokenToUpdate) {
				const updatedBalances = await onUpdateSome(tokenToUpdate);
				return updatedBalances as TYChainTokens;
			}
			const updatedBalances = await onUpdate();
			return updatedBalances as TYChainTokens;
		},
		[onUpdate, onUpdateSome]
	);

	return {balances, isLoadingBalances: isLoading, onRefresh};
}
