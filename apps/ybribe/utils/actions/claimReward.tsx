import {ethers} from 'ethers';
import {CURVE_BRIBE_V3_ADDRESS} from '@common/utils/constants';

export async function	claimReward(
	provider: ethers.providers.Web3Provider,
	contractAddress: string,
	gauge: string,
	token: string
): Promise<boolean> {
	const	signer = provider.getSigner();
	const	user = await signer.getAddress();

	try {
		const	contract = new ethers.Contract(
			contractAddress, [
				'function claim_reward(address, address, address)',
				'function claim_reward_for(address, address, address)'
			],
			signer
		);
		if (contractAddress === CURVE_BRIBE_V3_ADDRESS) {
			const	transaction = await contract.claim_reward_for(user, gauge, token);
			const	transactionResult = await transaction.wait();
			if (transactionResult.status === 0) {
				console.error('Fail to perform transaction');
				return false;
			}
		} else {
			const	transaction = await contract.claim_reward(user, gauge, token);
			const	transactionResult = await transaction.wait();
			if (transactionResult.status === 0) {
				console.error('Fail to perform transaction');
				return false;
			}
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}
