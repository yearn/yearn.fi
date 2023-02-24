import {ethers} from 'ethers';
import VAULT_FACTORY_ABI from '@vaults/utils/abi/vaultFactory.abi';
import {VAULT_FACTORY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	createNewVaultsAndStrategies(
	provider: ethers.providers.JsonRpcProvider,
	gaugeAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(VAULT_FACTORY_ADDRESS, VAULT_FACTORY_ABI, signer);
	return handleTx(contract.createNewVaultsAndStrategies(gaugeAddress));
}

export async function	estimateGasForCreateNewVaultsAndStrategies(
	provider: ethers.providers.Provider,
	gaugeAddress: TAddress
): Promise<BigNumber> {
	const	contract = new ethers.Contract(VAULT_FACTORY_ADDRESS, VAULT_FACTORY_ABI, provider);
	return await contract.estimateGas.createNewVaultsAndStrategies(gaugeAddress);
}
