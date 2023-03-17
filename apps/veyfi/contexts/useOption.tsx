import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';

export type TOptionPosition = {
	balance: BigNumber,
}

export type	TOptionContext = {
	getRequiredEth: (amount: BigNumber) => Promise<BigNumber>,
	positions: TOptionPosition | undefined,
	allowances: TDict<BigNumber>,
	isLoading: boolean,
	refresh: () => void,
}

const defaultProps: TOptionContext = {
	getRequiredEth: async (): Promise<BigNumber> => formatBN(0),
	positions: undefined,
	allowances: {},
	isLoading: true,
	refresh: (): void => undefined
};

const VEYFI_OPTIONS_ADDRESS = toAddress(''); // TODO: update once deployed
const VEYFI_OYFI_ADDRESS = toAddress(''); // TODO: update once deployed

const OptionContext = createContext<TOptionContext>(defaultProps);
export const OptionContextApp = memo(function OptionContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address: userAddress, isActive} = useWeb3();

	const getRequiredEth = useCallback(async (amount: BigNumber): Promise<BigNumber> => {
		const currentProvider = getProvider(1);
		const optionsContract = new Contract(VEYFI_OPTIONS_ADDRESS, [], currentProvider); // TODO: update once abi is available
		const requiredEth = await optionsContract.eth_required(amount);

		return requiredEth;
	}, []);

	const positionsFetcher = useCallback(async (): Promise<TOptionPosition | undefined> => {
		if (!isActive|| !userAddress) {
			return undefined;
		}
        
		const currentProvider = getProvider(1);
		const oYFIContract = new Contract(VEYFI_OYFI_ADDRESS, [], currentProvider); // TODO: update once abi is available
		const balance = await oYFIContract.balanceOf(userAddress);
			
		return {balance};
	}, [isActive, userAddress]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'optionPositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<BigNumber>> => {
		if (!isActive || !userAddress) {
			return {};
		}
		const	currentProvider = getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	oYFIContract = new Contract(VEYFI_OYFI_ADDRESS, ERC20_ABI);

		const	[oYFIAllowanceOptions] = await ethcallProvider.tryAll([oYFIContract.allowance(userAddress, VEYFI_OPTIONS_ADDRESS)]) as BigNumber[];

		return ({
			[allowanceKey(VEYFI_OYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS)]: oYFIAllowanceOptions
		});
	}, [isActive, userAddress]);
	const	{data: allowances, mutate: refreshAllowances, isLoading: isLoadingAllowances} = useSWR(isActive && provider ? 'optionAllowances' : null, allowancesFetcher, {shouldRetryOnError: false});


	const refresh = useCallback((): void => {	
		refreshPositions();
		refreshAllowances();
	}, [refreshPositions, refreshAllowances]);

	const contextValue = useMemo((): TOptionContext => ({
		getRequiredEth,
		positions,
		allowances: allowances ?? {},
		isLoading: isLoadingPositions || isLoadingAllowances,
		refresh
	}), [allowances, getRequiredEth, isLoadingAllowances, isLoadingPositions, positions, refresh]);

	return (
		<OptionContext.Provider value={contextValue}>
			{children}
		</OptionContext.Provider>
	);
});

export const useOption = (): TOptionContext => useContext(OptionContext);
export default useOption;
