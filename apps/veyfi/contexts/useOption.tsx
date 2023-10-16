import React, {createContext, memo, useCallback, useContext, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {VEYFI_DYFI_ABI} from '@veYFI/utils/abi/veYFIdYFI.abi';
import {VEYFI_OPTIONS_ABI} from '@veYFI/utils/abi/veYFIOptions.abi';
import {VEYFI_CHAIN_ID, VEYFI_DYFI_ADDRESS, VEYFI_OPTIONS_ADDRESS} from '@veYFI/utils/constants';
import {readContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {BIG_ZERO, YFI_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {useTokenPrice} from '@common/hooks/useTokenPrice';

import type {ReactElement} from 'react';
import type {TNormalizedBN} from '@common/types/types';

export type TOptionContext = {
	getRequiredEth: (amount: bigint) => Promise<bigint>;
	dYFIPrice: number;
	position: TNormalizedBN;
	discount: TNormalizedBN;
	refresh: () => void;
};

const defaultProps: TOptionContext = {
	getRequiredEth: async (): Promise<bigint> => BIG_ZERO,
	dYFIPrice: 0,
	discount: toNormalizedBN(0),
	position: toNormalizedBN(0),
	refresh: (): void => undefined
};

const OptionContext = createContext<TOptionContext>(defaultProps);
export const OptionContextApp = memo(function OptionContextApp({children}: {children: ReactElement}): ReactElement {
	const {address: userAddress} = useWeb3();
	const [dYFIPrice, set_dYFIPrice] = useState<number>(0);
	const [position, set_position] = useState<TNormalizedBN>(toNormalizedBN(0));
	const [discount, set_discount] = useState<TNormalizedBN>(toNormalizedBN(0));
	const yfiPrice = useTokenPrice(YFI_ADDRESS);

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
		const discountRaw = await readContract({
			address: VEYFI_OPTIONS_ADDRESS,
			abi: VEYFI_OPTIONS_ABI,
			functionName: 'discount',
			chainId: VEYFI_CHAIN_ID
		});
		const discount = toNormalizedBN(discountRaw);
		const dYFIPrice = yfiPrice * Number(discount?.normalized || 0);
		set_dYFIPrice(dYFIPrice);
		set_discount(discount);
	}, [yfiPrice]);

	const refreshPositions = useAsyncTrigger(async (): Promise<void> => {
		if (!userAddress) {
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
	}, [userAddress]);

	const refresh = useAsync(async (): Promise<void> => {
		refreshPrice();
		refreshPositions();
	}, [refreshPrice, refreshPositions]);

	const contextValue = useDeepCompareMemo(
		(): TOptionContext => ({
			getRequiredEth,
			dYFIPrice,
			position,
			discount,
			refresh
		}),
		[getRequiredEth, dYFIPrice, position, discount, refresh]
	);

	return <OptionContext.Provider value={contextValue}>{children}</OptionContext.Provider>;
});

export const useOption = (): TOptionContext => useContext(OptionContext);
