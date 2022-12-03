import {ethers} from 'ethers';
import PARTNER_VAULT_ABI from '@common/utils/abi/partner.vault.abi';

import type {ContractInterface} from 'ethers';

export async function	depositViaPartner(
	provider: ethers.providers.Web3Provider,
	partnerContractAddress: string,
	partnerAddress: string,
	vaultAddress: string,
	amount: ethers.BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			partnerContractAddress,
			PARTNER_VAULT_ABI as ContractInterface,
			signer
		);
		const	transaction = await contract.deposit(
			vaultAddress,
			partnerAddress || process.env.PARTNER_ID_ADDRESS,
			amount
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