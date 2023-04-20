import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract, ethers} from 'ethers';
import useSWR from 'swr';
import {VEYFI_OPTIONS_ADDRESS, VEYFI_OYFI_ADDRESS} from '@veYFI/constants';
import VEYFI_OPTIONS_ABI from '@veYFI/utils/abi/veYFIOptions.abi';
import VEYFI_OYFI_ABI from '@veYFI/utils/abi/veYFIoYFI.abi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';

export type TOptionPosition = {
	balance: BigNumber,
}

export type	TOptionContext = {
	getRequiredEth: (amount: BigNumber) => Promise<BigNumber>,
	price: number | undefined,
	positions: TOptionPosition | undefined,
	allowances: TDict<BigNumber>,
	isLoading: boolean,
	refresh: () => void,
}

const defaultProps: TOptionContext = {
	getRequiredEth: async (): Promise<BigNumber> => formatBN(0),
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

	const getRequiredEth = useCallback(async (amount: BigNumber): Promise<BigNumber> => {
		const currentProvider = getProvider(1);
		const optionsContract = new Contract(VEYFI_OPTIONS_ADDRESS, VEYFI_OPTIONS_ABI, currentProvider); // TODO: update once abi is available
		const requiredEth = await optionsContract.eth_required(amount);

		return requiredEth;
	}, []);

	const priceFetcher = useCallback(async (): Promise<number | undefined> => {
		const oneOption = ethers.utils.parseEther('1');
		const requiredEthPerOption = await getRequiredEth(oneOption);
		const requiredEthValuePerOption = toNormalizedValue(requiredEthPerOption, 18) * ethPrice;
		const pricePerOption = yfiPrice - requiredEthValuePerOption;
		return pricePerOption;
	}, [ethPrice, yfiPrice, getRequiredEth]);
	const {data: price, mutate: refreshPrice, isLoading: isLoadingPrice} = useSWR('optionPrice', priceFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TOptionPosition | undefined> => {
		if (!isActive|| !userAddress) {
			return undefined;
		}
        
		const currentProvider = getProvider(1);
		const oYFIContract = new Contract(VEYFI_OYFI_ADDRESS, VEYFI_OYFI_ABI, currentProvider); // TODO: update once abi is available
		const balance = await oYFIContract.balanceOf(userAddress);
			
		return {balance};
	}, [isActive, userAddress]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider ? 'optionPositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<BigNumber>> => {
		if (!isActive || !userAddress) {
			return {};
		}
		const	currentProvider = getProvider(1);
		const	oYFIContract = new Contract(VEYFI_OYFI_ADDRESS, ERC20_ABI, currentProvider);
		const	oYFIAllowanceOptions = await oYFIContract.allowance(userAddress, VEYFI_OPTIONS_ADDRESS);

		return ({
			[allowanceKey(VEYFI_OYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS)]: oYFIAllowanceOptions
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
		isLoading: isLoadingPrice || isLoadingPositions || isLoadingAllowances,
		refresh
	}), [allowances, getRequiredEth, isLoadingAllowances, isLoadingPositions, isLoadingPrice, positions, price, refresh]);

	return (
		<OptionContext.Provider value={contextValue}>
			{children}
		</OptionContext.Provider>
	);
});

export const useOption = (): TOptionContext => useContext(OptionContext);
export default useOption;
