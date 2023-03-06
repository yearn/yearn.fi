import {ethers} from 'ethers';
import {CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	addReward(
	provider: TWeb3Provider,
	gaugeAddress: string,
	tokenAddress: string,
	amount: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(
		CURVE_BRIBE_V3_ADDRESS as string,
		['function add_reward_amount(address, address, uint256) external'],
		signer
	);
	return await handleTx(contract.add_reward_amount(gaugeAddress, tokenAddress, amount));
}
