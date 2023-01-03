import {ethers} from 'ethers';
import VAULT_MIGRATOR_ABI from '@vaults/utils/abi/vaultMigrator.abi';

import type {ContractInterface} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export async function	migrateShares(
	provider: ethers.providers.Web3Provider,
	migratorAddress: TAddress,
	fromVault: TAddress,
	toVault: TAddress
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			migratorAddress,
			VAULT_MIGRATOR_ABI as ContractInterface,
			signer
		);
		const	transaction = await contract.migrateAll(fromVault, toVault);
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
