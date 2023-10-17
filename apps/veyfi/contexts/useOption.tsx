import React, {createContext, memo, useCallback, useContext, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {VEYFI_DYFI_ABI} from '@veYFI/utils/abi/veYFIdYFI.abi';
import {VEYFI_OPTIONS_ABI} from '@veYFI/utils/abi/veYFIOptions.abi';
import {VEYFI_CHAIN_ID, VEYFI_DYFI_ADDRESS,VEYFI_OPTIONS_ADDRESS} from '@veYFI/utils/constants';
import {erc20ABI, readContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {BIG_ZERO, ETH_TOKEN_ADDRESS, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@common/types/types';

export type	TOptionContext = {
	getRequiredEth: (amount: bigint) => Promise<bigint>,
	price: number | undefined,
	position: TNormalizedBN,
	allowances: TDict<bigint>,
	refresh: () => void,
}

const defaultProps: TOptionContext = {
	getRequiredEth: async (): Promise<bigint> => BIG_ZERO,
	price: undefined,
	position: toNormalizedBN(0),
	allowances: {},
	refresh: (): void => undefined
};

const OptionContext = createContext<TOptionContext>(defaultProps);
export const OptionContextApp = memo(function OptionContextApp({children}: {children: ReactElement}): ReactElement {
	const {address: userAddress, isActive} = useWeb3();
	const [price, set_price] = useState<number | undefined>(undefined);
	const [position, set_position] = useState<TNormalizedBN>(toNormalizedBN(0));
	const [allowances, set_allowances] = useState<TDict<bigint>>({});
	const yfiPrice = useTokenPrice(YFI_ADDRESS);
	const ethPrice = useTokenPrice(ETH_TOKEN_ADDRESS);

	const getRequiredEth = useCallback(async (amount: bigint): Promise<bigint> => {
		return readContract({
			address: VEYFI_OPTIONS_ADDRESS,
			abi: VEYFI_OPTIONS_ABI,
			functionName: 'eth_required',
			args: [amount],
			chainId: VEYFI_CHAIN_ID
		});
	}, []);

	const refreshPrice = useAsyncTrigger(async (): Promise<void> => {
		console.log(ethPrice, yfiPrice);
		if(!ethPrice || !yfiPrice) {
			return undefined;
		}
		const oneOption = toBigInt(1e18);
		const requiredEthPerOption = await getRequiredEth(oneOption);
		const requiredEthValuePerOption = toNormalizedValue(requiredEthPerOption, 18) * ethPrice;
		const pricePerOption = yfiPrice - requiredEthValuePerOption;
		set_price(pricePerOption);
	}, [ethPrice, yfiPrice, getRequiredEth]);

	const refreshPositions = useAsyncTrigger(async (): Promise<void> => {
		if (!isActive || !userAddress) {
			return;
		}

		const dYFIBalance = await readContract({
			address: VEYFI_DYFI_ADDRESS,
			abi: VEYFI_DYFI_ABI,
			functionName: 'balanceOf',
			args: [userAddress],
			chainId: VEYFI_CHAIN_ID
		});
		set_position(toNormalizedBN(dYFIBalance));
	}, [isActive, userAddress]);

	const refreshAllowances = useAsyncTrigger(async (): Promise<void> => {
		if (!isActive || !userAddress) {
			return;
		}

		const dYFIAllowanceOptions = await readContract({
			address: VEYFI_DYFI_ADDRESS,
			abi: erc20ABI,
			functionName: 'allowance',
			args: [userAddress, VEYFI_OPTIONS_ADDRESS],
			chainId: VEYFI_CHAIN_ID
		});

		set_allowances({
			[allowanceKey(VEYFI_CHAIN_ID, VEYFI_DYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS, userAddress)]: dYFIAllowanceOptions
		});
	}, [isActive, userAddress]);

	const refresh = useCallback((): void => {
		refreshPrice();
		refreshPositions();
		refreshAllowances();
	}, [refreshPrice, refreshPositions, refreshAllowances]);

	const contextValue = useDeepCompareMemo((): TOptionContext => ({
		getRequiredEth,
		price,
		position,
		allowances: allowances ?? {},
		refresh
	}), [allowances, getRequiredEth, position, price, refresh]);

	return (
		<OptionContext.Provider value={contextValue}>
			{children}
		</OptionContext.Provider>
	);
});

export const useOption = (): TOptionContext => useContext(OptionContext);
