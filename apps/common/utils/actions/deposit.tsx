import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {BigNumber} from 'ethers';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	deposit(
	provider: ethers.providers.JsonRpcProvider,
	vaultAddress: string,
	amount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(vaultAddress, ['function deposit(uint256) external returns (uint256)'], signer);
	return await handleTx(contract.deposit(amount));
}
