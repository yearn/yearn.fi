// We need the following line so that Next.js actually refetch the data when a
// fast refresh is done. Cf https://nextjs.org/docs/architecture/fast-refresh#tips
// @refresh reset

import {useEffect, useMemo} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import {useAsync} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {addressZero} from '@yearn-finance/web-lib/utils/address';
import {BALWETH_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, VEBAL_TOKEN_ADDRESS, VEBALPEG_QUERY_HELP_CONTRACT, YBAL_TOKEN_ADDRESS, YBAL_VOTER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {parseUnits, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {handleSettle} from '@common/utils';
import STYBAL_ABI from '@yBal/utils/abi/styBal.abi';
import VE_BAL_ABI from '@yBal/utils/abi/veBAL.abi';
import VEBALPEG_HELPER_ABI from '@yBal/utils/abi/veBalPegHelper.abi';

import type {BigNumber} from 'ethers';

export type THoldings = {
	yBalSupply: BigNumber;
	styBalSupply: BigNumber;
	lpyBalSupply: BigNumber;
	balYBalPeg: BigNumber;
	treasury: BigNumber;
	veBalTotalSupply: BigNumber;
	veBalBalance: BigNumber;
}

export const defaultHoldingsProps = {
	yBalSupply: Zero,
	styBalSupply: Zero,
	lpyBalSupply: Zero,
	balYBalPeg: Zero,
	treasury: Zero,
	veBalTotalSupply: Zero,
	veBalBalance: Zero
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
export function useHoldings(): THoldings {
	const {provider, address} = useWeb3();

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the holdings data for the yBal ecosystem.
	**************************************************************************/
	const [{result: holdings}, actions] = useAsync(async (): Promise<THoldings> => {
		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const yBalContract = new Contract(YBAL_TOKEN_ADDRESS, ERC20_ABI);
		const lpyBalContract = new Contract(LPYBAL_TOKEN_ADDRESS, ERC20_ABI);
		const styBalContract = new Contract(STYBAL_TOKEN_ADDRESS, STYBAL_ABI);
		const veBalContract = new Contract(VEBAL_TOKEN_ADDRESS, VE_BAL_ABI);

		const veBalQueryPegHelpContract = new ethers.Contract(VEBALPEG_QUERY_HELP_CONTRACT, VEBALPEG_HELPER_ABI, currentProvider);
		const pegSwapArguments = {
			poolId: '0xd61e198e139369a40818fe05f5d5e6e045cd6eaf000000000000000000000540',
			kind: 0,
			assetIn: BALWETH_TOKEN_ADDRESS, //BALWETH
			assetOut: YBAL_TOKEN_ADDRESS, //YBAL
			amount: parseUnits('1'),
			userData: '0x'
		};
		const pegFundArguments = {
			sender: addressZero,
			fromInternalBalance: false,
			recipient: addressZero,
			toInternalBalance: false
		};
		try {
			const [promisedResult, promisedPeg] = await Promise.allSettled([
				ethcallProvider.tryAll([
					/* 0 */ yBalContract.totalSupply(),
					/* 1 */ styBalContract.totalAssets(),
					/* 2 */ lpyBalContract.totalSupply(),
					/* 3 */ veBalContract.totalSupply(),
					/* 4 */ veBalContract.balanceOf(YBAL_VOTER_ADDRESS)
				]),
				veBalQueryPegHelpContract.callStatic.querySwap(pegSwapArguments, pegFundArguments)
			]);
			const result = handleSettle<BigNumber[]>(promisedResult, [Zero]);
			const peg = handleSettle<BigNumber>(promisedPeg, Zero);
			const yBalTotalSupply = result[0] || Zero;
			const styBalTotalSupply = result[1] || Zero;
			const lpyBalTotalSupply = result[2] || Zero;
			const veBalTotalSupply = result[3] || Zero;
			const veBalBalance = result[4] || Zero;
			return ({
				yBalSupply: yBalTotalSupply,
				styBalSupply: styBalTotalSupply,
				lpyBalSupply: lpyBalTotalSupply,
				treasury: veBalBalance.sub(yBalTotalSupply),
				veBalTotalSupply: veBalTotalSupply,
				veBalBalance: veBalBalance,
				balYBalPeg: peg
			});
		} catch (error) {
			console.error(error);
			return defaultHoldingsProps;
		}
	}, defaultHoldingsProps);

	useEffect((): void => {
		actions.execute();
	}, [address, provider, actions]);

	return useMemo((): THoldings => holdings, [holdings]);
}

