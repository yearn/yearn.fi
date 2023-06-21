// We need the following line so that Next.js actually refetch the data a fast
// refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useMemo} from 'react';
import {parseEther} from 'viem';
import {useContractReads} from 'wagmi';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import CURVE_CRV_YCRV_LP_ABI from '@yCRV/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yCRV/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';

export type TCRVHoldings = {
	legacy: bigint;
	treasury: bigint;
	yCRVSupply: bigint;
	styCRVSupply: bigint;
	lpyCRVSupply: bigint;
	crvYCRVPeg: bigint;
	boostMultiplier: bigint;
	veCRVTotalSupply: bigint;
	veCRVBalance: bigint;
}

export const defaultHoldings = {
	legacy: 0n,
	treasury: 0n,
	yCRVSupply: 0n,
	styCRVSupply: 0n,
	lpyCRVSupply: 0n,
	crvYCRVPeg: 0n,
	boostMultiplier: 0n,
	veCRVTotalSupply: 0n,
	veCRVBalance: 0n
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
export function useHoldings(): TCRVHoldings {
	const yCRVContract = {address: YCRV_TOKEN_ADDRESS, abi: YVECRV_ABI};
	const styCRVContract = {address: STYCRV_TOKEN_ADDRESS, abi: STYCRV_ABI};
	const lpyCRVContract = {address: LPYCRV_TOKEN_ADDRESS, abi: YVECRV_ABI};
	const yveCRVContract = {address: YVECRV_TOKEN_ADDRESS, abi: YVECRV_ABI};
	const veEscrowContract = {address: VECRV_ADDRESS, abi: YVECRV_ABI};
	const crvYCRVLpContract = {address: YCRV_CURVE_POOL_ADDRESS, abi: CURVE_CRV_YCRV_LP_ABI};

	const {data, status} = useContractReads({
		contracts: [
			{...yveCRVContract, functionName: 'totalSupply'},
			{...yveCRVContract, functionName: 'balanceOf', args: [YCRV_TOKEN_ADDRESS]},
			{...veEscrowContract, functionName: 'balanceOf', args: [VECRV_YEARN_TREASURY_ADDRESS]},
			{...veEscrowContract, functionName: 'totalSupply'},
			{...yCRVContract, functionName: 'totalSupply'},
			{...styCRVContract, functionName: 'totalAssets'},
			{...lpyCRVContract, functionName: 'totalSupply'},
			{...crvYCRVLpContract, functionName: 'get_dy', args: [1n, 0n, parseEther('1')]}
		]
	});

	return useMemo((): TCRVHoldings => {
		if (!data || status !== 'success') {
			return defaultHoldings;
		}
		const yveCRVTotalSupply = decodeAsBigInt(data[0]);
		const yveCRVInYCRV = decodeAsBigInt(data[1]);
		const veCRVBalance = decodeAsBigInt(data[2]); //used for "Yearn Has" section
		const veCRVTotalSupply = decodeAsBigInt(data[3]);
		const yCRVTotalSupply = decodeAsBigInt(data[4]);
		const styCRVTotalSupply = decodeAsBigInt(data[5]);
		const lpyCRVTotalSupply = decodeAsBigInt(data[6]);
		const crvYCRVPeg = decodeAsBigInt(data[7]);
		return ({
			legacy: yveCRVTotalSupply - yveCRVInYCRV,
			treasury: veCRVBalance - ((yveCRVTotalSupply - yveCRVInYCRV) + yCRVTotalSupply),
			yCRVSupply: yCRVTotalSupply,
			styCRVSupply: styCRVTotalSupply,
			lpyCRVSupply: lpyCRVTotalSupply,
			crvYCRVPeg: crvYCRVPeg,
			boostMultiplier: veCRVBalance * (toBigInt(1e4) / (styCRVTotalSupply || 1n)),
			veCRVTotalSupply: veCRVTotalSupply,
			veCRVBalance: veCRVBalance
		});
	}, [data, status]);
}

