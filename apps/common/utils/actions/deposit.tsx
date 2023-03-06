import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	deposit(
	provider: TWeb3Provider,
	vaultAddress: string,
	amount: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(vaultAddress, ['function deposit(uint256) external returns (uint256)'], signer);
	return await handleTx(contract.deposit(amount));
}
