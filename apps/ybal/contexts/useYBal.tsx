import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {BAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YBAL_BALANCER_POOL_ADDRESS, YBAL_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatUnits, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import CURVE_CRV_YCRV_LP_ABI from '@yBal/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yBal/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yBal/utils/abi/yveCRV.abi';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonHarvests, TYearnVault} from '@common/types/yearn';

type THoldings = {
	legacy: BigNumber;
	treasury: BigNumber;
	yBalSupply: BigNumber;
	styBalSupply: BigNumber;
	lpyBalSupply: BigNumber;
	balYBalPeg: BigNumber;
	boostMultiplier: BigNumber;
	veBalTotalSupply: BigNumber;
	veBalBalance: BigNumber;
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
		legacy: Zero,
		treasury: Zero,
		yBalSupply: Zero,
		styBalSupply: Zero,
		lpyBalSupply: Zero,
		balYBalPeg: Zero,
		boostMultiplier: Zero,
		veBalTotalSupply: Zero,
		veBalBalance: Zero
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
	const numbersFetchers = useCallback(async (): Promise<TDict<BigNumber>> => {
		const	currentProvider = provider || getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);

		const	yBalContract = new Contract(YBAL_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styBalContract = new Contract(STYBAL_TOKEN_ADDRESS as string, STYCRV_ABI);
		const	lpyBalContract = new Contract(LPYBAL_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	veEscrowContract = new Contract(VECRV_ADDRESS as string, YVECRV_ABI);
		const	crvYCRVLpContract = new Contract(YBAL_BALANCER_POOL_ADDRESS as string, CURVE_CRV_YCRV_LP_ABI);

		const	[
			yveBalTotalSupply,
			yveCRVInYCRV,
			veBalBalance,
			veBalTotalSupply,
			yCRVTotalSupply,
			styCRVTotalSupply,
			lpyCRVTotalSupply,
			balYBalPeg
		] = await ethcallProvider.tryAll([
			yveCRVContract.totalSupply(),
			yveCRVContract.balanceOf(YBAL_TOKEN_ADDRESS),
			veEscrowContract.balanceOf(VECRV_YEARN_TREASURY_ADDRESS),
			veEscrowContract.totalSupply(),
			yBalContract.totalSupply(),
			styBalContract.totalAssets(),
			lpyBalContract.totalSupply(),
			crvYCRVLpContract.get_dy(1, 0, ethers.constants.WeiPerEther)
		]) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			['legacy']: yveBalTotalSupply.sub(yveCRVInYCRV),
			['treasury']: veBalBalance.sub(yveBalTotalSupply.sub(yveCRVInYCRV)).sub(yCRVTotalSupply),
			['yBalSupply']: yCRVTotalSupply,
			['styBalSupply']: styCRVTotalSupply,
			['lpyBalSupply']: lpyCRVTotalSupply,
			['balYBalPeg']: balYBalPeg,
			['boostMultiplier']: veBalBalance.mul(1e4).div(styCRVTotalSupply),
			['veBalTotalSupply']: veBalTotalSupply,
			['veBalBalance']: veBalBalance
		});
	}, [provider]);
	const	{data: holdings} = useSWR('numbers', numbersFetchers, {shouldRetryOnError: false});


	/* 🔵 - Yearn Finance ******************************************************
	**	Once the wallet is connected and a provider is available, we can fetch
	**	the allowance informations for a specific wallet. As the possible path
	**	are limited, we can hardcode the contract addresses.
	***************************************************************************/
	const getAllowances = useCallback(async (): Promise<TDict<BigNumber>> => {
		if (!isActive || !provider) {
			return {};
		}
		const	currentProvider = provider || getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	userAddress = address;
		const	yBalContract = new Contract(YBAL_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styBalContract = new Contract(STYBAL_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	lpyBalContract = new Contract(LPYBAL_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	balContract = new Contract(BAL_TOKEN_ADDRESS as string, ERC20_ABI);
		const	yvBoostContract = new Contract(YVBOOST_TOKEN_ADDRESS as string, ERC20_ABI);
		const	yBalPoolContract = new Contract(YBAL_BALANCER_POOL_ADDRESS as string, YVECRV_ABI);

		const	[
			yCRVAllowanceZap, styCRVAllowanceZap, lpyCRVAllowanceZap,
			yveCRVAllowanceZap, crvAllowanceZap, yvBoostAllowanceZap,
			yveCRVAllowanceLP, crvAllowanceLP,
			yCRVPoolAllowanceVault
		] = await ethcallProvider.tryAll([
			yBalContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			styBalContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			lpyBalContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			balContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yvBoostContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			balContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			yBalPoolContract.allowance(userAddress, LPYBAL_TOKEN_ADDRESS)
		]) as BigNumber[];

		return ({
			// YCRV ECOSYSTEM
			[allowanceKey(1, YBAL_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(userAddress))]: yCRVAllowanceZap,
			[allowanceKey(1, STYBAL_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(userAddress))]: styCRVAllowanceZap,
			[allowanceKey(1, LPYBAL_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(userAddress))]: lpyCRVAllowanceZap,
			[allowanceKey(1, YBAL_BALANCER_POOL_ADDRESS, LPYBAL_TOKEN_ADDRESS, toAddress(userAddress))]: yCRVPoolAllowanceVault,
			// CRV ECOSYSTEM
			[allowanceKey(1, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(userAddress))]: yveCRVAllowanceZap,
			[allowanceKey(1, BAL_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(userAddress))]:  crvAllowanceZap,
			[allowanceKey(1, YVBOOST_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS, toAddress(userAddress))]: yvBoostAllowanceZap,
			[allowanceKey(1, YVECRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, toAddress(userAddress))]: yveCRVAllowanceLP,
			[allowanceKey(1, BAL_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, toAddress(userAddress))]:  crvAllowanceLP
		});
	}, [provider, address, isActive]);
	const	{data: allowances} = useSWR(isActive && provider ? 'allowances' : null, getAllowances, {shouldRetryOnError: false});

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
		return (((styBalVault as TYearnVault)?.apy?.net_apy || 0) * 100);
		// return (((styBalVault as TYearnVault)?.apy?.net_apy || 0) * 100) + (styBalMegaBoost * 100);
		// return (styCRVExperimentalAPY * 100) + (styBalMegaBoost * 100);
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
