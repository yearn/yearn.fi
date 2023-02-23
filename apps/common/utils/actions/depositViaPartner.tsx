import {ethers} from 'ethers';
import PARTNER_VAULT_ABI from '@yearn-finance/web-lib/utils/abi/partner.vault.abi';


export async function	depositViaPartner(
	provider: ethers.providers.JsonRpcProvider,
	partnerContractAddress: string,
	partnerAddress: string,
	vaultAddress: string,
	amount: ethers.BigNumber,
	gasLimit?: number
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			partnerContractAddress,
			PARTNER_VAULT_ABI,
			signer
		);
		const	transaction = await contract.deposit(
			vaultAddress,
			partnerAddress || process.env.PARTNER_ID_ADDRESS,
			amount,
			(gasLimit && gasLimit >= 0) ? {gasLimit} : {}
		);
		const	transactionResult = await transaction.wait();
		if (transactionResult.status === 0) {
			console.error('Fail to perform transaction');
			return false;
		}

		return true;
	} catch(error) {
		console.error(error);
		const	errorCode = (error as {code: ethers.errors})?.code || '';
		if (errorCode === 'UNPREDICTABLE_GAS_LIMIT' && gasLimit !== -1) {
			depositViaPartner(
				provider,
				partnerContractAddress,
				partnerAddress,
				vaultAddress,
				amount,
				gasLimit ? 300_000 : -1
			);
		}
		return false;
	}
}
