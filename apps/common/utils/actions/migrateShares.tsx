import {ethers} from 'ethers';
import VAULT_MIGRATOR_ABI from '@vaults/utils/abi/vaultMigrator.abi';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	migrateShares(
	provider: TWeb3Provider,
	migratorAddress: TAddress,
	fromVault: TAddress,
	toVault: TAddress
): Promise<TTxResponse> {
	const {toast} = yToast();
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(migratorAddress, VAULT_MIGRATOR_ABI, signer);
	const estimate = await contract.migrateAll.estimateGas(fromVault, toVault);
	const estimateGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(estimate);
	const safeGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(estimate * 13n / 10n);
	toast({
		type: 'info',
		content: `Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`,
		duration: 10000
	});
	console.info(`Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`);

	return await handleTx(contract.migrateAll(fromVault, toVault, {gasLimit: estimate * 13n / 10n}));
}
