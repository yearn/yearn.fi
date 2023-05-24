import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {BAL_TOKEN_ADDRESS, BALWETH_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, YBAL_BALANCER_POOL_ADDRESS, YBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatUnits, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import STYBAL_ABI from '@yBal/utils/abi/styBal.abi';
import YBAL_BALANCER_POOL_ABI from '@yBal/utils/abi/yBalBalancerPool.abi';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonHarvests} from '@common/types/yearn';

type THoldings = {
	yBalSupply: BigNumber;
	styBalSupply: BigNumber;
	lpyBalSupply: BigNumber;
	balYBalPeg: BigNumber;
}
type TYBalContext = {
	styBalMegaBoost: number,
	styBalAPY: number,
	slippage: number,
	allowances: TDict<BigNumber>,
	holdings: THoldings,
	harvests: TYDaemonHarvests[],
	set_slippage: (slippage: number) => void,
}

const	defaultProps = {
	styBalMegaBoost: 0,
	styBalAPY: 0,
	harvests: [],
	allowances: {},
	slippage: 0.6,
	set_slippage: (): void => undefined,
	holdings: {
		yBalSupply: Zero,
		styBalSupply: Zero,
		lpyBalSupply: Zero,
		balYBalPeg: Zero
	}
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
const	YBalContext = createContext<TYBalContext>(defaultProps);
export const YBalContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const {provider, address, isActive} = useWeb3();
	const {settings: baseAPISettings} = useSettings();
	const [slippage, set_slippage] = useState<number>(0.6);

	const	{data: styBalVault} = useSWR(
		`${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}/1/vaults/${STYBAL_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	{data: yBalHarvests} = useSWR(
		`${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${STYBAL_TOKEN_ADDRESS},${LPYBAL_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the holdings data for the yBal ecosystem.
	**************************************************************************/
	const numbersFetchers = useCallback(async (): Promise<THoldings> => {
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const yBalContract = new Contract(YBAL_TOKEN_ADDRESS, ERC20_ABI);
		const lpyBalContract = new Contract(LPYBAL_TOKEN_ADDRESS, ERC20_ABI);
		const styBalContract = new Contract(STYBAL_TOKEN_ADDRESS, STYBAL_ABI);
		const yBalBalancerPoolContract = new Contract(YBAL_BALANCER_POOL_ADDRESS, YBAL_BALANCER_POOL_ABI);
		const calls = [
			yBalContract.totalSupply(),
			styBalContract.totalAssets(),
			lpyBalContract.totalSupply(),
			yBalBalancerPoolContract.getRate()
		];
		const result = await ethcallProvider.tryAll(calls) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			yBalSupply: result[1] || Zero,
			styBalSupply: result[2] || Zero,
			lpyBalSupply: result[3] || Zero,
			balYBalPeg: result[4] || Zero
		});
	}, [provider]);

	const {data: holdings} = useSWR('numbers', numbersFetchers, {shouldRetryOnError: false});


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
		const userAddress = address;
		const calls = [
			new Contract(BAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, ZAP_YEARN_YBAL_ADDRESS),
			new Contract(WETH_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, ZAP_YEARN_YBAL_ADDRESS),
			new Contract(BALWETH_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, ZAP_YEARN_YBAL_ADDRESS),
			new Contract(YBAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, ZAP_YEARN_YBAL_ADDRESS),
			new Contract(STYBAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, ZAP_YEARN_YBAL_ADDRESS),
			new Contract(LPYBAL_TOKEN_ADDRESS, ERC20_ABI).allowance(userAddress, ZAP_YEARN_YBAL_ADDRESS)
		];
		const result = await ethcallProvider.tryAll(calls) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			[allowanceKey(1, BAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[0] || Zero,
			[allowanceKey(1, WETH_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[1] || Zero,
			[allowanceKey(1, BALWETH_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[2] || Zero,
			[allowanceKey(1, YBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[3] || Zero,
			[allowanceKey(1, STYBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[4] || Zero,
			[allowanceKey(1, LPYBAL_TOKEN_ADDRESS, ZAP_YEARN_YBAL_ADDRESS, toAddress(userAddress))]: result[5] || Zero
		});
	}, [provider, address, isActive]);
	const {data: allowances} = useSWR(isActive && provider ? 'allowances' : null, getAllowances, {shouldRetryOnError: false});

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the mega boost for the staked yBal. This boost come from the
	** donator, with 30_000 per week.
	**************************************************************************/
	const	styBalMegaBoost = useMemo((): number => {
		if (!holdings || holdings.styBalSupply === Zero) {
			return 0;
		}
		const	fromDonatorPerWeek = 30_000;
		const	fromDonatorPerYear = fromDonatorPerWeek * 52;
		const	fromDonatorPerYearScaled = fromDonatorPerYear * 0.9;
		const	humanizedStyBalSupply = Number(formatUnits(holdings.styBalSupply, 18));
		const	megaBoostAPR = fromDonatorPerYearScaled / humanizedStyBalSupply;
		return megaBoostAPR;
	}, [holdings]);

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styCRV APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const	styBalAPY = useMemo((): number => {
		return ((styBalVault?.apy?.net_apy || 0) * 100);
	}, [styBalVault]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TYBalContext => ({
		harvests: yBalHarvests,
		holdings: holdings as THoldings,
		allowances: allowances as TDict<BigNumber>,
		styBalAPY,
		styBalMegaBoost,
		slippage,
		set_slippage
	}), [yBalHarvests, holdings, allowances, styBalAPY, styBalMegaBoost, slippage, set_slippage]);

	return (
		<YBalContext.Provider value={contextValue}>
			{children}
		</YBalContext.Provider>
	);
};


export const useYBal = (): TYBalContext => useContext(YBalContext);
export default useYBal;
