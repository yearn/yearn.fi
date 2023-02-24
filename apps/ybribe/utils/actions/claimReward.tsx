import {ethers} from 'ethers';
import {CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	claimReward(
	provider: ethers.providers.JsonRpcProvider,
	contractAddress: string,
	gauge: string,
	token: string
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const user = await signer.getAddress();
	const contract = new ethers.Contract(
		contractAddress, [
			'function claim_reward(address, address, address)',
			'function claim_reward_for(address, address, address)'
		],
		signer
	);
	if (contractAddress === CURVE_BRIBE_V3_ADDRESS) {
		return await handleTx(contract.claim_reward_for(user, gauge, token));
	}
	return await handleTx(contract.claim_reward(user, gauge, token));

}
