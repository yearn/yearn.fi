import {ethers} from 'ethers';
import VAULT_MIGRATOR_ABI from '@vaults/utils/abi/vaultMigrator.abi';
import {yToast} from '@yearn-finance/web-lib/components/yToast';

import type {ContractInterface} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export async function	migrateShares(
	provider: ethers.providers.Web3Provider,
	migratorAddress: TAddress,
	fromVault: TAddress,
	toVault: TAddress
): Promise<boolean> {
	const {toast} = yToast();
	const signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			migratorAddress,
			VAULT_MIGRATOR_ABI as ContractInterface,
			signer
		);
		const	estimate = await contract.estimateGas.migrateAll(fromVault, toVault);
		const	estimateGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(estimate.toBigInt());
		const	safeGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(estimate.mul(13).div(10).toBigInt());
		toast({
			type: 'info',
			content: `Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`,
			duration: 10000
		});
		console.info(`Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`);

		const	transaction = await contract.migrateAll(fromVault, toVault, {gasLimit: estimate.mul(13).div(10)});
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
