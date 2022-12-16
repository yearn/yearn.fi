import {ethers} from 'ethers';
import {EXTERNAL_SERVICE_PROVIDER} from '@vaults/utils/migrationTable';
import {PARTNER_VAULT_ABI} from '@yearn-finance/web-lib/utils/abi';

import type {ContractInterface} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export async function	depositVia(
	provider: ethers.providers.Web3Provider,
	viaContractAddress: TAddress,
	serviceID: EXTERNAL_SERVICE_PROVIDER,
	addressFrom: TAddress,
	addressTo: TAddress,
	amount: ethers.BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	addressTo;
	amount;

	try {
		let abi: ContractInterface = PARTNER_VAULT_ABI;
		let	method = 'deposit';
		let params: unknown[] = [];

		if ([
			EXTERNAL_SERVICE_PROVIDER.COMPOUND,
			EXTERNAL_SERVICE_PROVIDER.AAVEV1,
			EXTERNAL_SERVICE_PROVIDER.AAVEV2
		].includes(serviceID)) {
			method = 'migrate';
			params = [[serviceID, addressFrom]];
			abi = [{'inputs':[{'components':[{'internalType':'enum YVEmpire.Service', 'name':'service', 'type':'uint8'}, {'internalType':'address', 'name':'coin', 'type':'address'}], 'internalType':'struct YVEmpire.Swap[]', 'name':'swaps', 'type':'tuple[]'}], 'name':'migrate', 'outputs':[], 'stateMutability':'nonpayable', 'type':'function'}];
		} else {
			console.error('Invalid service ID');
			return false;
		}

		const	contract = new ethers.Contract(viaContractAddress, abi, signer);
		const	transaction = await contract[method](params);
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