'use client';

import {useDeepCompareMemo} from '@react-hookz/web';
import type {ReactElement} from 'react';
import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {serialize} from 'wagmi';
import {useWeb3} from '../contexts/useWeb3';
import type {TUseBalancesTokens} from '../hooks/useBalances.multichains';
import {useBalances} from '../hooks/useBalances.multichains';
import type {TAddress, TChainTokens, TDict, TNDict, TNormalizedBN, TToken, TYChainTokens} from '../types';
import {DEFAULT_ERC20, toAddress, zeroNormalizedBN} from '../utils';
import {createUniqueID} from '../utils/tools.identifier';
import {useYearn} from './useYearn';
import {useYearnTokens} from './useYearn.helper';

type TTokenAndChain = {address: TAddress; chainID: number};
type TWalletContext = {
	getToken: ({address, chainID}: TTokenAndChain) => TToken;
	getBalance: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	balances: TChainTokens;
	balanceHash: string;
	isLoading: boolean;
	cumulatedValueInV2Vaults: number;
	cumulatedValueInV3Vaults: number;
	onRefresh: (
		tokenList?: TUseBalancesTokens[],
		shouldSaveInStorage?: boolean,
		shouldForceFetch?: boolean
	) => Promise<TChainTokens>;
};

const defaultProps = {
	getToken: (): TToken => DEFAULT_ERC20,
	getBalance: (): TNormalizedBN => zeroNormalizedBN,
	balances: {},
	balanceHash: '',
	isLoading: true,
	cumulatedValueInV2Vaults: 0,
	cumulatedValueInV3Vaults: 0,
	onRefresh: async (): Promise<TChainTokens> => ({})
};

/*******************************************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp(props: {
	children: ReactElement;
	shouldWorkOnTestnet?: boolean;
}): ReactElement {
	const {chainID} = useWeb3();
	const {vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList, getPrice} = useYearn();
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
	const getToken = useCallback(
		({address, chainID}: TTokenAndChain): TToken => balances?.[chainID || 1]?.[address] || DEFAULT_ERC20,
		[balances]
	);

	/**************************************************************************
	 ** getBalance is a safe retrieval of a balance from the balances state
	 **************************************************************************/
	const getBalance = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN =>
			balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN,
		[balances]
	);

	/**********************************************************************************************
	 ** Balances is an object with multiple level of depth. We want to create a unique hash from
	 ** it to know when it changes. This new hash will be used to trigger the useEffect hook.
	 ** We will use classic hash function to create a hash from the balances object.
	 *********************************************************************************************/
	const balanceHash = useMemo(() => {
		const hash = createUniqueID(serialize(balances));
		return hash;
	}, [balances]);

	const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
		const allVaults = {
			...vaults,
			...vaultsMigrations,
			...vaultsRetired
		};

		let cumulatedValueInV2Vaults = 0;
		let cumulatedValueInV3Vaults = 0;

		for (const perChain of Object.values(balances)) {
			for (const [tokenAddress, tokenData] of Object.entries(perChain)) {
				if (!allVaults?.[toAddress(tokenAddress)]) {
					continue;
				}

				const tokenBalance = tokenData.balance;
				const tokenPrice = getPrice({address: tokenData.address, chainID: tokenData.chainID});
				const tokenValue = tokenBalance.normalized * tokenPrice.normalized;

				let stakingValue = 0;
				const vaultDetails = allVaults[toAddress(tokenAddress)];

				if (vaultDetails?.staking) {
					// Check if vaultDetails and its staking property exist
					const {staking} = vaultDetails; // Safe to destructure now
					const hasStaking = staking.available ?? false;
					if (hasStaking && staking.address) {
						// Ensure staking.address is also valid
						const stakingAddress = staking.address;
						const stakingBalance = getBalance({address: stakingAddress, chainID: tokenData.chainID});

						stakingValue = stakingBalance.normalized * tokenPrice.normalized;
					}
				}

				if (allVaults?.[toAddress(tokenAddress)]) {
					if (vaultDetails.version.split('.')?.[0] === '3' || vaultDetails.version.split('.')?.[0] === '~3') {
						cumulatedValueInV3Vaults += tokenValue + stakingValue;
					} else {
						cumulatedValueInV2Vaults += tokenValue + stakingValue;
					}
				}
			}
		}
		return [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults];
	}, [balances, getBalance, getPrice, vaults, vaultsMigrations, vaultsRetired]);

	/***************************************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useDeepCompareMemo(
		(): TWalletContext => ({
			getToken,
			getBalance,
			balances,
			balanceHash,
			isLoading: isLoading || false,
			onRefresh,
			cumulatedValueInV2Vaults,
			cumulatedValueInV3Vaults
		}),
		[
			getToken,
			getBalance,
			balances,
			balanceHash,
			isLoading,
			onRefresh,
			cumulatedValueInV2Vaults,
			cumulatedValueInV3Vaults
		]
	);

	return <WalletContext.Provider value={contextValue}>{props.children}</WalletContext.Provider>;
});

export const useWallet = (): TWalletContext => useContext(WalletContext);
export default useWallet;
