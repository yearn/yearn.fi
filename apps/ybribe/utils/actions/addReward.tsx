import {ethers} from 'ethers';
import {CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {BigNumber} from 'ethers';

export async function	addReward(
	provider: ethers.providers.JsonRpcProvider,
	gaugeAddress: string,
	tokenAddress: string,
	amount: BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();
	try {
		const	contract = new ethers.Contract(
			CURVE_BRIBE_V3_ADDRESS as string,
			['function add_reward_amount(address, address, uint256) external'],
			signer
		);
		const	transaction = await contract.add_reward_amount(
			gaugeAddress,
			tokenAddress,
			amount
		);
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
