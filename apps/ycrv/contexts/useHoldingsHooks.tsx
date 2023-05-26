// We need the following line so that Next.js actually refetch the data a fast
// refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useEffect, useMemo} from 'react';
import {useRouter} from 'next/router';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import {useAsync} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import CURVE_CRV_YCRV_LP_ABI from '@yCRV/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yCRV/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';

import type {BigNumber} from 'ethers';

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

const	defaultProps = {
	legacy: Zero,
	treasury: Zero,
	yCRVSupply: Zero,
	styCRVSupply: Zero,
	lpyCRVSupply: Zero,
	crvYCRVPeg: Zero,
	boostMultiplier: Zero,
	veCRVTotalSupply: Zero,
	veCRVBalance: Zero
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
export function useHoldings(): THoldings {
	const router = useRouter();
	const {provider, address} = useWeb3();

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the holdings data for the yCRV ecosystem.
	**************************************************************************/
	const [{result: holdings}, actions] = useAsync(async (): Promise<THoldings> => {
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const yCRVContract = new Contract(YCRV_TOKEN_ADDRESS, YVECRV_ABI);
		const styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS, STYCRV_ABI);
		const lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS, YVECRV_ABI);
		const yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS, YVECRV_ABI);
		const veEscrowContract = new Contract(VECRV_ADDRESS, YVECRV_ABI);
		const crvYCRVLpContract = new Contract(YCRV_CURVE_POOL_ADDRESS, CURVE_CRV_YCRV_LP_ABI);

		const results = await ethcallProvider.tryAll([
			/* 0 */ yveCRVContract.totalSupply(),
			/* 1 */ yveCRVContract.balanceOf(YCRV_TOKEN_ADDRESS),
			/* 2 */ veEscrowContract.balanceOf(VECRV_YEARN_TREASURY_ADDRESS),
			/* 3 */ veEscrowContract.totalSupply(),
			/* 4 */ yCRVContract.totalSupply(),
			/* 5 */ styCRVContract.totalAssets(),
			/* 6 */ lpyCRVContract.totalSupply(),
			/* 7 */ crvYCRVLpContract.get_dy(1, 0, ethers.constants.WeiPerEther)
		]) as BigNumber[];

		const yveCRVTotalSupply = results[0] || Zero;
		const yveCRVInYCRV = results[1] || Zero;
		const veCRVBalance = results[2] || Zero; //used for "Yearn Has" section
		const veCRVTotalSupply = results[3] || Zero;
		const yCRVTotalSupply = results[4] || Zero;
		const styCRVTotalSupply = results[5] || Zero;
		const lpyCRVTotalSupply = results[6] || Zero;
		const crvYCRVPeg = results[7] || Zero;
		return ({
			legacy: yveCRVTotalSupply.sub(yveCRVInYCRV),
			//Treasury is: [balance of veCRV hold by the treasuryAddress] - [total supply of yveCRV] - [balance of yveCRV hold by yCRV contract] - [total supply of yCRV]
			treasury: veCRVBalance.sub(yveCRVTotalSupply.sub(yveCRVInYCRV)).sub(yCRVTotalSupply),
			yCRVSupply: yCRVTotalSupply,
			styCRVSupply: styCRVTotalSupply,
			lpyCRVSupply: lpyCRVTotalSupply,
			crvYCRVPeg: crvYCRVPeg,
			boostMultiplier: veCRVBalance.mul(1e4).div(styCRVTotalSupply),
			veCRVTotalSupply: veCRVTotalSupply,
			veCRVBalance: veCRVBalance
		});
	}, defaultProps);

	useEffect((): void => {
		actions.execute();
	}, [address, provider, actions.execute, actions, router.isReady]);

	return useMemo((): THoldings => holdings, [holdings]);
}

