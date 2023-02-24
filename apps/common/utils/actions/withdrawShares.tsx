import {ethers} from 'ethers';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	withdrawShares(
	provider: ethers.providers.JsonRpcProvider,
	vaultAddress: string,
	maxShares: ethers.BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
	return await handleTx(contract.withdraw(maxShares));
}
