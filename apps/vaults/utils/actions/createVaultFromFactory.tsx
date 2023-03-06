import {ethers} from 'ethers';
import VAULT_FACTORY_ABI from '@vaults/utils/abi/vaultFactory.abi';
import {VAULT_FACTORY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	createNewVaultsAndStrategies(
	provider: TWeb3Provider,
	gaugeAddress: TAddress
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(VAULT_FACTORY_ADDRESS, VAULT_FACTORY_ABI, signer);
	return await handleTx(contract.createNewVaultsAndStrategies(gaugeAddress));
}

export async function	estimateGasForCreateNewVaultsAndStrategies(
	provider: TWeb3Provider,
	gaugeAddress: TAddress
): Promise<bigint> {
	const	contract = new ethers.Contract(VAULT_FACTORY_ADDRESS, VAULT_FACTORY_ABI, provider);
	return await contract.createNewVaultsAndStrategies.estimateGas(gaugeAddress);
}
