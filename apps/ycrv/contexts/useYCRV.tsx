import React, {createContext, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {format, providers} from '@yearn-finance/web-lib/utils';
import {baseFetcher} from '@common/utils';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@common/utils/constants';
import CURVE_CRV_YCRV_LP_ABI from '@yCRV/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yCRV/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
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
	holdings: THoldings,
	harvests: TYDaemonHarvests[],
}

const	defaultProps = {
	styCRVMegaBoost: 0,
	styCRVAPY: 0,
	harvests: [],
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
	const	{provider} = useWeb3();
	const	{data: styCRVExperimentalAPY} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/apy/${STYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	);
	const	{data: yCRVHarvests} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${STYCRV_TOKEN_ADDRESS},${LPYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the holdings data for the yCRV ecosystem.
	**************************************************************************/
	const numbersFetchers = useCallback(async (): Promise<{[key: string]: BigNumber}> => {
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
	const	{data: holdings} = useSWR('numbers', numbersFetchers, {refreshInterval: 10000, shouldRetryOnError: false});

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
		const	humanizedStyCRVSupply = Number(format.units(holdings.styCRVSupply, 18));
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
				styCRVAPY,
				styCRVMegaBoost
			}}>
			{children}
		</YCRVContext.Provider>
	);
};


export const useYCRV = (): TYCRVContext => useContext(YCRVContext);
export default useYCRV;