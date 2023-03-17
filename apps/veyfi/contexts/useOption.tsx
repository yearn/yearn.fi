import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';

export type TOptionPosition = {
	balance: BigNumber,
	redeemable: BigNumber,
	fee: BigNumber
}

export type	TOptionContext = {
	positions: TOptionPosition | undefined,
	isLoading: boolean,
	refresh: () => void,
}

const defaultProps: TOptionContext = {
	positions: undefined,
	isLoading: true,
	refresh: (): void => undefined
};

const VEYFI_OPTIONS_ADDRESS = toAddress(''); // TODO: update once deployed
const VEYFI_OYFI_ADDRESS = toAddress(''); // TODO: update once deployed

const OptionContext = createContext<TOptionContext>(defaultProps);
export const OptionContextApp = memo(function OptionContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address: userAddress, isActive} = useWeb3();

	const positionsFetcher = useCallback(async (): Promise<TOptionPosition | undefined> => {
		if (!isActive|| !userAddress) {
			return undefined;
		}
        
		const currentProvider = getProvider(1);
		const oYFIContract = new Contract(VEYFI_OYFI_ADDRESS, [], currentProvider); // TODO: update once abi is available
		const balance = await oYFIContract.balanceOf(userAddress);
		const optionsContract = new Contract(VEYFI_OPTIONS_ADDRESS, [], currentProvider); // TODO: update once abi is available
		const redeemable = await optionsContract.callStatic.exercise(balance, userAddress);
		const fee = await optionsContract.eth_required(balance);
			
		return {
			balance,
			redeemable,
			fee
		};
	}, [isActive, userAddress]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'optionPositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const refresh = useCallback((): void => {	
		refreshPositions();
	}, [refreshPositions]);

	const contextValue = useMemo((): TOptionContext => ({
		positions,
		isLoading: isLoadingPositions,
		refresh
	}), [isLoadingPositions, positions, refresh]);

	return (
		<OptionContext.Provider value={contextValue}>
			{children}
		</OptionContext.Provider>
	);
});

export const useOption = (): TOptionContext => useContext(OptionContext);
export default useOption;
