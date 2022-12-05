import React, {createContext, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {providers} from '@yearn-finance/web-lib/utils';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatUnits} from '@yearn-finance/web-lib/utils/format.bigNumber';
import CURVE_CRV_YCRV_LP_ABI from '@yCRV/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yCRV/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/utils';
import type {TYDaemonHarvests} from '@common/types/yearn';

type THoldings = {
	legacy: BigNumber;
	treasury: BigNumber;
	yCRVSupply: BigNumber;
	styCRVSupply: BigNumber;
	lpyCRVSupply: BigNumber;
	crvYCRVPeg: BigNumber;
	boostMultiplier: BigNumber;
	veCRVTotalSupply: BigNumber;
	veCRVBalance: BigNumber;
}
type TYCRVContext = {
	styCRVMegaBoost: number,
	styCRVAPY: number,
	allowances: TDict<BigNumber>,
	holdings: THoldings,
	harvests: TYDaemonHarvests[],
}

const	defaultProps = {
	styCRVMegaBoost: 0,
	styCRVAPY: 0,
	harvests: [],
	allowances: {},
	holdings: {
		legacy: ethers.constants.Zero,
		treasury: ethers.constants.Zero,
		yCRVSupply: ethers.constants.Zero,
		styCRVSupply: ethers.constants.Zero,
		lpyCRVSupply: ethers.constants.Zero,
		crvYCRVPeg: ethers.constants.Zero,
		boostMultiplier: ethers.constants.Zero,
		veCRVTotalSupply: ethers.constants.Zero,
		veCRVBalance: ethers.constants.Zero
	}
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
const	YCRVContext = createContext<TYCRVContext>(defaultProps);
export const YCRVContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const	{provider, address, isActive} = useWeb3();

	const	{data: styCRVExperimentalAPY} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/apy/${STYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	{data: yCRVHarvests} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${STYCRV_TOKEN_ADDRESS},${LPYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the holdings data for the yCRV ecosystem.
	**************************************************************************/
	const numbersFetchers = useCallback(async (): Promise<TDict<BigNumber>> => {
		const	currentProvider = provider || providers.getProvider(1);
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);

		const	yCRVContract = new Contract(YCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS as string, STYCRV_ABI);
		const	lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	veEscrowContract = new Contract(VECRV_ADDRESS as string, YVECRV_ABI);
		const	crvYCRVLpContract = new Contract(YCRV_CURVE_POOL_ADDRESS as string, CURVE_CRV_YCRV_LP_ABI);

		const	[
			yveCRVTotalSupply,
			yveCRVInYCRV,
			veCRVBalance,
			veCRVTotalSupply,
			yCRVTotalSupply,
			styCRVTotalSupply,
			lpyCRVTotalSupply,
			crvYCRVPeg
		] = await ethcallProvider.tryAll([
			yveCRVContract.totalSupply(),
			yveCRVContract.balanceOf(YCRV_TOKEN_ADDRESS),
			veEscrowContract.balanceOf(VECRV_YEARN_TREASURY_ADDRESS),
			veEscrowContract.totalSupply(),
			yCRVContract.totalSupply(),
			styCRVContract.totalAssets(),
			lpyCRVContract.totalSupply(),
			crvYCRVLpContract.get_dy(1, 0, ethers.constants.WeiPerEther)
		]) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			['legacy']: yveCRVTotalSupply.sub(yveCRVInYCRV),
			['treasury']: veCRVBalance.sub(yveCRVTotalSupply.sub(yveCRVInYCRV)).sub(yCRVTotalSupply),
			['yCRVSupply']: yCRVTotalSupply,
			['styCRVSupply']: styCRVTotalSupply,
			['lpyCRVSupply']: lpyCRVTotalSupply,
			['crvYCRVPeg']: crvYCRVPeg,
			['boostMultiplier']: veCRVBalance.mul(1e4).div(styCRVTotalSupply),
			['veCRVTotalSupply']: veCRVTotalSupply,
			['veCRVBalance']: veCRVBalance
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
		const	currentProvider = provider || providers.getProvider(1);
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);
		const	userAddress = address;
		const	yCRVContract = new Contract(YCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	crvContract = new Contract(CRV_TOKEN_ADDRESS as string, ERC20_ABI);
		const	yvBoostContract = new Contract(YVBOOST_TOKEN_ADDRESS as string, ERC20_ABI);
		const	yCRVPoolContract = new Contract(YCRV_CURVE_POOL_ADDRESS as string, YVECRV_ABI);

		const	[
			yCRVAllowanceZap, styCRVAllowanceZap, lpyCRVAllowanceZap,
			yveCRVAllowanceZap, crvAllowanceZap, yvBoostAllowanceZap,
			yveCRVAllowanceLP, crvAllowanceLP,
			yCRVPoolAllowanceVault
		] = await ethcallProvider.tryAll([
			yCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			styCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			lpyCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			crvContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yvBoostContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			crvContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			yCRVPoolContract.allowance(userAddress, LPYCRV_TOKEN_ADDRESS)
		]) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			// YCRV ECOSYSTEM
			[allowanceKey(YCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: yCRVAllowanceZap,
			[allowanceKey(STYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: styCRVAllowanceZap,
			[allowanceKey(LPYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: lpyCRVAllowanceZap,
			[allowanceKey(YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS)]: yCRVPoolAllowanceVault,
			// CRV ECOSYSTEM
			[allowanceKey(YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: yveCRVAllowanceZap,
			[allowanceKey(CRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]:  crvAllowanceZap,
			[allowanceKey(YVBOOST_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: yvBoostAllowanceZap,
			[allowanceKey(YVECRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS)]: yveCRVAllowanceLP,
			[allowanceKey(CRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS)]:  crvAllowanceLP
		});
	}, [provider, address, isActive]);
	const	{data: allowances} = useSWR(isActive && provider ? 'allowances' : null, getAllowances, {shouldRetryOnError: false});

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the mega boost for the staked yCRV. This boost come from the
	** donator, with 30_000 per week.
	**************************************************************************/
	const	styCRVMegaBoost = useMemo((): number => {
		if (!holdings || holdings.styCRVSupply === ethers.constants.Zero) {
			return 0;
		}
		const	fromDonatorPerWeek = 30_000;
		const	fromDonatorPerYear = fromDonatorPerWeek * 52;
		const	fromDonatorPerYearScaled = fromDonatorPerYear * 0.9;
		const	humanizedStyCRVSupply = Number(formatUnits(holdings.styCRVSupply, 18));
		const	megaBoostAPR = fromDonatorPerYearScaled / humanizedStyCRVSupply;
		return megaBoostAPR;
	}, [holdings]);

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styCRV APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const	styCRVAPY = useMemo((): number => {
		return (styCRVExperimentalAPY * 100) + (styCRVMegaBoost * 100);
	}, [styCRVExperimentalAPY, styCRVMegaBoost]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	return (
		<YCRVContext.Provider
			value={{
				harvests: yCRVHarvests,
				holdings: holdings as THoldings,
				allowances: allowances as TDict<BigNumber>,
				styCRVAPY,
				styCRVMegaBoost
			}}>
			{children}
		</YCRVContext.Provider>
	);
};


export const useYCRV = (): TYCRVContext => useContext(YCRVContext);
export default useYCRV;