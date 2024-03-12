import {useCallback, useMemo} from 'react';
import {useBalances} from '@builtbymom/web3/hooks/useBalances.multichains';
import {toAddress} from '@builtbymom/web3/utils';
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

export function useYearnTokens({shouldUseForknetBalances}: {shouldUseForknetBalances: boolean}): TUseBalancesTokens[] {
	const {vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList} = useYearn();

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
		const tokens = [...availableTokens, ...migratableTokens, ...retiredTokens];
		if (!shouldUseForknetBalances) {
			return tokens;
		}
		for (const token of tokens) {
			if (token.chainID === 1) {
				//remove it
				tokens.push({...token, chainID: 1337});
			}
		}
		return tokens;
	}, [availableTokens, migratableTokens, retiredTokens, shouldUseForknetBalances]);

	return allTokens;
}

export function useYearnBalances({shouldUseForknetBalances}: {shouldUseForknetBalances: boolean}): {
	tokens: TYChainTokens;
	isLoading: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
} {
	const {prices} = useYearn();
	const allTokens = useYearnTokens({shouldUseForknetBalances});
	const {data: tokensRaw, onUpdate, onUpdateSome, isLoading} = useBalances({tokens: allTokens, prices});

	const tokens = useDeepCompareMemo((): TYChainTokens => {
		const _tokens = {...tokensRaw};
		if (shouldUseForknetBalances) {
			_tokens[1] = _tokens[1337]; // eslint-disable-line prefer-destructuring
		}

		return _tokens as TYChainTokens;
	}, [tokensRaw, shouldUseForknetBalances]);

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
