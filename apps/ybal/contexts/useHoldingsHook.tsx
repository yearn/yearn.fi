// We need the following line so that Next.js actually refetch the data when a
// fast refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useMemo} from 'react';
import {parseEther} from 'viem';
import {useContractReads, usePrepareContractWrite} from 'wagmi';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {BALWETH_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, VEBAL_TOKEN_ADDRESS, VEBALPEG_QUERY_HELP_CONTRACT, YBAL_TOKEN_ADDRESS, YBAL_VOTER_ADDRESS, ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';
import STYBAL_ABI from '@yBal/utils/abi/styBal.abi';
import VE_BAL_ABI from '@yBal/utils/abi/veBAL.abi';
import VEBALPEG_HELPER_ABI from '@yBal/utils/abi/veBalPegHelper.abi';

import type {Hex} from 'viem';

export type TBalHoldings = {
	yBalSupply: bigint;
	styBalSupply: bigint;
	lpyBalSupply: bigint;
	balYBalPeg: bigint;
	treasury: bigint;
	veBalTotalSupply: bigint;
	veBalBalance: bigint;
}

export const defaultBalHoldings = {
	yBalSupply: 0n,
	styBalSupply: 0n,
	lpyBalSupply: 0n,
	balYBalPeg: 0n,
	treasury: 0n,
	veBalTotalSupply: 0n,
	veBalBalance: 0n
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
export function useHoldings(): TBalHoldings {
	const yBalContract = {address: YBAL_TOKEN_ADDRESS, abi: ERC20_ABI};
	const lpyBalContract = {address: LPYBAL_TOKEN_ADDRESS, abi: ERC20_ABI};
	const styBalContract = {address: STYBAL_TOKEN_ADDRESS, abi: STYBAL_ABI};
	const veBalContract = {address: VEBAL_TOKEN_ADDRESS, abi: VE_BAL_ABI};
	const veBalQueryPegHelpContract = {address: VEBALPEG_QUERY_HELP_CONTRACT, abi: VEBALPEG_HELPER_ABI};

	const pegSwapArguments = {
		poolId: '0xd61e198e139369a40818fe05f5d5e6e045cd6eaf000000000000000000000540' as Hex,
		kind: 0,
		assetIn: BALWETH_TOKEN_ADDRESS, //BALWETH
		assetOut: YBAL_TOKEN_ADDRESS, //YBAL
		amount: parseEther('1'),
		userData: '0x' as Hex
	};
	const pegFundArguments = {
		sender: ZERO_ADDRESS,
		fromInternalBalance: false,
		recipient: ZERO_ADDRESS,
		toInternalBalance: false
	};

	const {data, status} = useContractReads({
		contracts: [
			{...yBalContract, functionName: 'totalSupply'},
			{...styBalContract, functionName: 'totalAssets'},
			{...lpyBalContract, functionName: 'totalSupply'},
			{...veBalContract, functionName: 'totalSupply'},
			{...veBalContract, functionName: 'balanceOf', args: [YBAL_VOTER_ADDRESS]}
		]
	});
	const {data: peg, status: pegStatus} = usePrepareContractWrite({
		...veBalQueryPegHelpContract,
		functionName: 'querySwap',
		args: [pegSwapArguments, pegFundArguments]
	});

	const baseHolding = useMemo((): TBalHoldings => {
		if (!data || status !== 'success') {
			return defaultBalHoldings;
		}
		const yBalTotalSupply = decodeAsBigInt(data[0]);
		const styBalTotalSupply = decodeAsBigInt(data[1]);
		const lpyBalTotalSupply = decodeAsBigInt(data[2]);
		const veBalTotalSupply = decodeAsBigInt(data[3]);
		const veBalBalance = decodeAsBigInt(data[4]);
		return ({
			yBalSupply: yBalTotalSupply,
			styBalSupply: styBalTotalSupply,
			lpyBalSupply: lpyBalTotalSupply,
			treasury: veBalBalance - yBalTotalSupply,
			veBalTotalSupply: veBalTotalSupply,
			veBalBalance: veBalBalance,
			balYBalPeg: 0n
		});
	}, [data, status]);

	const basePeg = useMemo((): bigint => {
		if (!peg || pegStatus !== 'success') {
			return 0n;
		}
		return peg.result;
	}, [peg, pegStatus]);

	return ({
		...baseHolding as TBalHoldings,
		balYBalPeg: basePeg
	});
}

