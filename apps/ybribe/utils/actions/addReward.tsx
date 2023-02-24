import {ethers} from 'ethers';
import {CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {BigNumber} from 'ethers';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	addReward(
	provider: ethers.providers.JsonRpcProvider,
	gaugeAddress: string,
	tokenAddress: string,
	amount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(
		CURVE_BRIBE_V3_ADDRESS as string,
		['function add_reward_amount(address, address, uint256) external'],
		signer
	);
	return await handleTx(contract.add_reward_amount(gaugeAddress, tokenAddress, amount));
}
