import {useCallback, useMemo} from 'react';
import {useTokenList} from '@builtbymom/web3/contexts/WithTokenList';
import {useBalances} from '@builtbymom/web3/hooks/useBalances.multichains';
import {useChainID} from '@builtbymom/web3/hooks/useChainID';
import {toAddress} from '@builtbymom/web3/utils';
import {getNetwork} from '@builtbymom/web3/utils/wagmi';
import {useDeepCompareMemo} from '@react-hookz/web';
import {
	CRV_TOKEN_ADDRESS,
	CVXCRV_TOKEN_ADDRESS,
	ETH_TOKEN_ADDRESS,
	LPYCRV_TOKEN_ADDRESS,
	LPYCRV_V2_TOKEN_ADDRESS,
	YCRV_CURVE_POOL_V2_ADDRESS,
	YCRV_TOKEN_ADDRESS,
	YVBOOST_TOKEN_ADDRESS,
	YVECRV_TOKEN_ADDRESS
} from '@yearn-finance/web-lib/utils/constants';

import {useYearn} from './useYearn';

import type {TYChainTokens} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TDict} from '@builtbymom/web3/types';

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

	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
			return [];
		}
		const tokens: TUseBalancesTokens[] = [];
		const tokensExists: TDict<boolean> = {};
		const extraTokens: TUseBalancesTokens[] = [];
		extraTokens.push(
			...[
				{chainID: 1, address: ETH_TOKEN_ADDRESS},
				{chainID: 10, address: ETH_TOKEN_ADDRESS},
				{chainID: 137, address: ETH_TOKEN_ADDRESS},
				{chainID: 250, address: ETH_TOKEN_ADDRESS},
				{chainID: 8453, address: ETH_TOKEN_ADDRESS},
				{chainID: 42161, address: ETH_TOKEN_ADDRESS},
				{chainID: 1, address: YCRV_TOKEN_ADDRESS},
				{chainID: 1, address: LPYCRV_TOKEN_ADDRESS},
				{chainID: 1, address: CRV_TOKEN_ADDRESS},
				{chainID: 1, address: YVBOOST_TOKEN_ADDRESS},
				{chainID: 1, address: YVECRV_TOKEN_ADDRESS},
				{chainID: 1, address: CVXCRV_TOKEN_ADDRESS},
				{chainID: 1, address: YCRV_CURVE_POOL_V2_ADDRESS},
				{chainID: 1, address: LPYCRV_V2_TOKEN_ADDRESS}
			]
		);

		for (const token of extraTokens) {
			tokensExists[token.address] = true;
			tokens.push(token);
		}

		Object.values(vaults || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			if (vault?.address && !tokensExists[toAddress(vault?.address)]) {
				tokens.push({address: vault.address, chainID: vault.chainID});
				tokensExists[vault.address] = true;
			}
			if (vault?.token?.address && !tokensExists[toAddress(vault?.token?.address)]) {
				tokens.push({address: vault.token.address, chainID: vault.chainID});
				tokensExists[vault.token.address] = true;
			}
			if (vault?.staking?.available && !tokensExists[toAddress(vault?.staking?.address)]) {
				tokens.push({
					address: vault?.staking?.address,
					chainID: vault.chainID,
					symbol: vault.symbol,
					decimals: vault.decimals,
					name: vault.name
				});
				tokensExists[vault?.staking?.address] = true;
			}
		});

		return tokens;
	}, [isLoadingVaultList, vaults]);

	//List all vaults with a possible migration
	const migratableTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsMigrations || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({address: vault.address, chainID: vault.chainID});
		});
		return tokens;
	}, [vaultsMigrations]);

	const retiredTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsRetired || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({address: vault.address, chainID: vault.chainID});
		});
		return tokens;
	}, [vaultsRetired]);

	const allTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens = [...availableTokens, ...migratableTokens, ...retiredTokens, ...availableTokenListTokens];
		return tokens;
	}, [availableTokens, migratableTokens, retiredTokens, availableTokenListTokens]);

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
	tokens: TYChainTokens;
	isLoading: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
} {
	const {prices} = useYearn();
	const allTokens = useYearnTokens({vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList});
	const {data: tokensRaw, onUpdate, onUpdateSome, isLoading} = useBalances({tokens: allTokens, prices});

	const tokens = useDeepCompareMemo((): TYChainTokens => {
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

	return {tokens, isLoading, onRefresh};
}
