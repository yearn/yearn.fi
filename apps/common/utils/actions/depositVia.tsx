import {ethers} from 'ethers';
import {EXTERNAL_SERVICE_PROVIDER} from '@vaults/utils/migrationTable';
import PARTNER_VAULT_ABI from '@yearn-finance/web-lib/utils/abi/partner.vault.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {ContractInterface} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	depositVia(
	provider: ethers.providers.JsonRpcProvider,
	viaContractAddress: TAddress,
	serviceID: EXTERNAL_SERVICE_PROVIDER,
	addressFrom: TAddress,
	addressTo: TAddress,
	amount: ethers.BigNumber
): Promise<TTxResponse> {
	const	signer = provider.getSigner();

	addressTo;
	amount;

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
		return {isSuccessful: false};
	}

	const	contract = new ethers.Contract(viaContractAddress, abi, signer);
	return await handleTx(contract[method](params));
}
