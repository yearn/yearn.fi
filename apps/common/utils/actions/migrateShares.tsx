import VAULT_MIGRATOR_ABI from '@vaults/utils/abi/vaultMigrator.abi';
import {prepareWriteContract} from '@wagmi/core';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {toWagmiProvider, writeContract} from '@common/utils/toWagmiProvider';

import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	migrateShares(
	connector: Connector,
	migratorAddress: TAddress,
	fromVault: TAddress,
	toVault: TAddress
): Promise<TTxResponse> {
	const {toast} = yToast();
	const wagmiProvider = await toWagmiProvider(connector);
	const config = await prepareWriteContract({
		...wagmiProvider,
		address: toWagmiAddress(migratorAddress),
		abi: VAULT_MIGRATOR_ABI,
		functionName: 'migrateAll',
		args: [toWagmiAddress(fromVault), toWagmiAddress(toVault)]
	});

	const gas = config?.request?.gas || 0n;
	const estimateGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(gas);
	const safeGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(gas * 13n / 10n);
	toast({
		type: 'info',
		content: `Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`,
		duration: 10000
	});
	console.info(`Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`);
	config.request.gas = gas * 13n / 10n;
	return await writeContract(config);
}

