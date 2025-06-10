import {useCallback, useMemo, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useTokenList} from '@lib/contexts/WithTokenList';
import {useChainID} from '@lib/hooks/useChainID';
import {toAddress} from '@lib/utils';
import {ETH_TOKEN_ADDRESS} from '@lib/utils/constants';
import {getNetwork} from '@lib/utils/wagmi';

import {useBalances} from './useBalances.multichains';

import type {TUseBalancesTokens} from '@lib/hooks/useBalances.multichains';
import type {TDict, TNDict, TToken, TYChainTokens} from '@lib/types';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

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
	const {currentNetworkTokenList} = useTokenList();
	const {safeChainID} = useChainID();
	const [isReady, set_isReady] = useState(false);
	const allVaults = useMemo(
		(): TYDaemonVault[] => [
			...Object.values(vaults),
			...Object.values(vaultsMigrations),
			...Object.values(vaultsRetired)
		],
		[vaults, vaultsMigrations, vaultsRetired]
	);

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

		const {nativeCurrency} = getNetwork(safeChainID);
		if (nativeCurrency) {
			tokens.push({
				address: toAddress(ETH_TOKEN_ADDRESS),
				chainID: safeChainID,
				decimals: nativeCurrency.decimals,
				name: nativeCurrency.name,
				symbol: nativeCurrency.symbol
			});
		}
		return tokens;
	}, [safeChainID, currentNetworkTokenList]);

	//List available tokens
	const availableTokens = useMemo((): TDict<TUseBalancesTokens> => {
		if (isLoadingVaultList) {
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

		allVaults.forEach((vault?: TYDaemonVault): void => {
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

		set_isReady(true);
		return tokens;
	}, [isLoadingVaultList, allVaults]);

	const allTokens = useMemo((): TUseBalancesTokens[] => {
		if (!isReady) {
			return [];
		}
		const fromAvailableTokens = Object.values(availableTokens);
		const tokens = [...fromAvailableTokens, ...availableTokenListTokens];
		return tokens;
	}, [isReady, availableTokens, availableTokenListTokens]);

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
	balances: TNDict<TDict<TToken>>;
	isLoadingBalances: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
} {
	const {chainID} = useWeb3();
	const allTokens = useYearnTokens({vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList});
	const {
		data: tokensRaw, // Expected to be TDict<TNormalizedBN | undefined>
		onUpdate,
		onUpdateSome,
		isLoading
	} = useBalances({
		tokens: allTokens,
		priorityChainID: chainID
	});
	const balances = useDeepCompareMemo((): TNDict<TDict<TToken>> => {
		const filteredTokens: TNDict<TDict<TToken>> = {};
		for (const chainID in tokensRaw) {
			const chainTokens = tokensRaw[chainID];
			const intermediateFilteredChainTokens: TDict<TToken> = {};
			for (const address in chainTokens) {
				const tokenData = chainTokens[address];
				// Only include if raw balance is greater than 0 or staking is available (staking balance will be checked in the next step)
				if (tokenData.balance.raw > 0n || vaults[toAddress(address)]?.staking) {
					intermediateFilteredChainTokens[address] = tokenData;
				}
			}
			filteredTokens[Number(chainID)] = intermediateFilteredChainTokens;
		}
		return filteredTokens;
	}, [tokensRaw, vaults]);

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
