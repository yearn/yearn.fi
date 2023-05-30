import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {BAL_TOKEN_ADDRESS, BALWETH_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {defaultHoldingsProps, useHoldings} from '@yBal/contexts/useHoldingsHooks';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {THoldings} from '@yBal/contexts/useHoldingsHooks';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TYDaemonHarvests} from '@common/types/yearn';

const LOCAL_ZAP_YEARN_YBAL_ADDRESS = toAddress('0x43cA9bAe8dF108684E5EAaA720C25e1b32B0A075');

type TYBalContext = {
	styBalAPY: number,
	slippage: number,
	allowances: TDict<BigNumber>,
	holdings: THoldings,
	harvests: TYDaemonHarvests[],
	set_slippage: (slippage: number) => void,
}

const defaultProps = {
	styBalAPY: 0,
	harvests: [],
	allowances: {},
	slippage: 0.6,
	set_slippage: (): void => undefined,
	holdings: defaultHoldingsProps
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
const YBalContext = createContext<TYBalContext>(defaultProps);

export const YBalContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const {provider, address: userAddress, isActive} = useWeb3();
	const {settings: baseAPISettings} = useSettings();
	const [slippage, set_slippage] = useState(0.6);
	const holdings = useHoldings();

	const YDAEMON_BASE_URI = `${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}`;

	const {data: styBalVault} = useFetch<TYDaemonVault>({
		endpoint: `${YDAEMON_BASE_URI}/1/vaults/${STYBAL_TOKEN_ADDRESS}`,
		schema: yDaemonVaultSchema
	});

	const {data: yBalHarvests} = useSWR(
		`${YDAEMON_BASE_URI}/1/vaults/harvests/${STYBAL_TOKEN_ADDRESS},${LPYBAL_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	/* 🔵 - Yearn Finance ******************************************************
	**	Once the wallet is connected and a provider is available, we can fetch
	**	the allowance informations for a specific wallet. As the possible path
	**	are limited, we can hardcode the contract addresses.
	***************************************************************************/
	const getAllowances = useCallback(async (): Promise<TDict<BigNumber>> => {
		if (!isActive || !provider) {
			return {};
		}
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const calls = [
			new Contract(BAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, LOCAL_ZAP_YEARN_YBAL_ADDRESS),
			new Contract(WETH_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, LOCAL_ZAP_YEARN_YBAL_ADDRESS),
			new Contract(BALWETH_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, LOCAL_ZAP_YEARN_YBAL_ADDRESS),
			new Contract(YBAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, LOCAL_ZAP_YEARN_YBAL_ADDRESS),
			new Contract(STYBAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, LOCAL_ZAP_YEARN_YBAL_ADDRESS),
			new Contract(LPYBAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, LOCAL_ZAP_YEARN_YBAL_ADDRESS)
		];
		const result = await ethcallProvider.tryAll(calls) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			[allowanceKey(1, BAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[0] || Zero,
			[allowanceKey(1, WETH_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[1] || Zero,
			[allowanceKey(1, BALWETH_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[2] || Zero,
			[allowanceKey(1, YBAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[3] || Zero,
			[allowanceKey(1, STYBAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[4] || Zero,
			[allowanceKey(1, LPYBAL_TOKEN_ADDRESS, LOCAL_ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[5] || Zero
		});
	}, [provider, userAddress, isActive]);

	const {data: allowances} = useSWR(isActive && provider ? 'allowances' : null, getAllowances, {shouldRetryOnError: false});

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styBal APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const styBalAPY = useMemo((): number => (styBalVault?.apy?.net_apy || 0) * 100, [styBalVault]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TYBalContext => ({
		harvests: yBalHarvests,
		holdings: holdings as THoldings,
		allowances: allowances as TDict<BigNumber>,
		styBalAPY,
		slippage,
		set_slippage
	}), [yBalHarvests, holdings, allowances, styBalAPY, slippage, set_slippage]);

	return (
		<YBalContext.Provider value={contextValue}>
			{children}
		</YBalContext.Provider>
	);
};

export const useYBal = (): TYBalContext => useContext(YBalContext);
export default useYBal;