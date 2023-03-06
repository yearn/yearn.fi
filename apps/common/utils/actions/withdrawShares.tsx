import {ethers} from 'ethers';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	withdrawShares(
	provider: TWeb3Provider,
	vaultAddress: string,
	maxShares: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
	return await handleTx(contract.withdraw(maxShares));
}
