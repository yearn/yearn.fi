import {ethers} from 'ethers';
import {YVECRV_POOL_LP_ADDRESS} from '@common/utils/constants';

import type {BigNumber} from 'ethers';

export async function	addLiquidity(
	provider: ethers.providers.Web3Provider,
	amount1: BigNumber,
	amount2: BigNumber,
	expectedAmount: BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			YVECRV_POOL_LP_ADDRESS,
			['function add_liquidity(uint256[2], uint256)'],
			signer
		);
		const	SLIPPAGE = 0.2;
		const	minAmountStr = Number(ethers.utils.formatUnits(expectedAmount, 18));
		const	minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - SLIPPAGE)).toFixed(18), 18);
		const	transaction = await contract.add_liquidity([amount1, amount2], minAmountWithSlippage);
		const	transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			console.error('Fail to perform transaction');
			return false;
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}
