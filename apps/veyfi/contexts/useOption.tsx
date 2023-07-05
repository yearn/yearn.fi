import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useAsync} from '@react-hookz/web';
import VEYFI_OPTIONS_ABI from '@veYFI/utils/abi/veYFIOptions.abi';
import VEYFI_OYFI_ABI from '@veYFI/utils/abi/veYFIoYFI.abi';
import {VEYFI_OPTIONS_ADDRESS, VEYFI_OYFI_ADDRESS} from '@veYFI/utils/constants';
import {erc20ABI, readContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {BIG_ZERO, ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';

export type TOptionPosition = {
	balance: bigint,
}

export type	TOptionContext = {
	getRequiredEth: (amount: bigint) => Promise<bigint>,
	price: number | undefined,
	positions: TOptionPosition | undefined,
	allowances: TDict<bigint>,
	isLoading: boolean,
	refresh: () => void,
}

const defaultProps: TOptionContext = {
	getRequiredEth: async (): Promise<bigint> => BIG_ZERO,
	price: undefined,
	positions: undefined,
	allowances: {},
	isLoading: true,
	refresh: (): void => undefined
};

const OptionContext = createContext<TOptionContext>(defaultProps);
export const OptionContextApp = memo(function OptionContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address: userAddress, isActive} = useWeb3();
	const yfiPrice = useTokenPrice(YFI_ADDRESS);
	const ethPrice = useTokenPrice(ETH_TOKEN_ADDRESS);

	const getRequiredEth = useCallback(async (amount: bigint): Promise<bigint> => {
		// TODO: update once abi is available
		return readContract({
			address: VEYFI_OPTIONS_ADDRESS,
			abi: VEYFI_OPTIONS_ABI,
			functionName: 'eth_required',
			args: [amount],
			chainId: 1
		});
	}, []);

	const priceFetcher = useCallback(async (): Promise<number | undefined> => {
		if(!ethPrice || !yfiPrice) {
			return undefined;
		}
		const oneOption = ethers.utils.parseEther('1');
		const requiredEthPerOption = await getRequiredEth(toBigInt(oneOption.toString()));
		const requiredEthValuePerOption = toNormalizedValue(requiredEthPerOption, 18) * ethPrice;
		const pricePerOption = yfiPrice - requiredEthValuePerOption;
		return pricePerOption;
	}, [ethPrice, yfiPrice, getRequiredEth]);

	const [{result: price, status: fetchPriceStatus}, {execute: refreshPrice}] = useAsync(async (): Promise<number | undefined> => {
		return priceFetcher();
	}, 0);
	
	const positionsFetcher = useCallback(async (): Promise<TOptionPosition | undefined> => {
		if (!isActive || !userAddress) {
			return undefined;
		}
        
		// TODO: update once abi is available
		return {
			balance: await readContract({
				address: VEYFI_OYFI_ADDRESS,
				abi: VEYFI_OYFI_ABI,
				functionName: 'balanceOf',
				args: [userAddress],
				chainId: 1
			})
		};
	}, [isActive, userAddress]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'optionPositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<bigint>> => {
		if (!isActive || !userAddress) {
			return {};
		}

		const oYFIAllowanceOptions = await readContract({
			address: VEYFI_OYFI_ADDRESS,
			abi: erc20ABI,
			functionName: 'allowance',
			args: [userAddress, VEYFI_OPTIONS_ADDRESS],
			chainId: 1
		});

		return ({
			[allowanceKey(1, VEYFI_OYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS, userAddress)]: oYFIAllowanceOptions
		});
	}, [isActive, userAddress]);
	const	{data: allowances, mutate: refreshAllowances, isLoading: isLoadingAllowances} = useSWR(isActive && provider ? 'optionAllowances' : null, allowancesFetcher, {shouldRetryOnError: false});


	const refresh = useCallback((): void => {
		refreshPrice();
		refreshPositions();
		refreshAllowances();
	}, [refreshPrice, refreshPositions, refreshAllowances]);

	const contextValue = useMemo((): TOptionContext => ({
		getRequiredEth,
		price,
		positions,
		allowances: allowances ?? {},
		isLoading: fetchPriceStatus === 'loading' || isLoadingPositions || isLoadingAllowances,
		refresh
	}), [allowances, fetchPriceStatus, getRequiredEth, isLoadingAllowances, isLoadingPositions, positions, price, refresh]);

	return (
		<OptionContext.Provider value={contextValue}>
			{children}
		</OptionContext.Provider>
	);
});

export const useOption = (): TOptionContext => useContext(OptionContext);
export default useOption;
