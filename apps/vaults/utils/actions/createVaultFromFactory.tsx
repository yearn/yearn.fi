import {ethers} from 'ethers';
import {VAULT_FACTORY_ADDRESS} from '@vaults/utils//constants';
import VAULT_FACTORY_ABI from '@vaults/utils/abi/vaultFactory.abi';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export async function	createNewVaultsAndStrategies(
	provider: ethers.providers.Web3Provider,
	gaugeAddress: TAddress
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			VAULT_FACTORY_ADDRESS,
			VAULT_FACTORY_ABI,
			signer
		);
		const	transaction = await contract.createNewVaultsAndStrategies(
			gaugeAddress
		);
		const	transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			console.error('Fail to perform transaction');
			return false;
		}

		return true;
	} catch(error) {
		console.error(error);
		return false;
	}
}

export async function	estimateGasForCreateNewVaultsAndStrategies(
	provider: ethers.providers.Provider,
	gaugeAddress: TAddress
): Promise<BigNumber> {
	console.warn(gaugeAddress, VAULT_FACTORY_ADDRESS);
	const	contract = new ethers.Contract(
		VAULT_FACTORY_ADDRESS,
		VAULT_FACTORY_ABI,
		provider
	);
	return await contract.estimateGas.createNewVaultsAndStrategies(gaugeAddress);
}
