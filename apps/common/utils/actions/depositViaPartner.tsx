import {ethers} from 'ethers';
import PARTNER_VAULT_ABI from '@yearn-finance/web-lib/utils/abi/partner.vault.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	depositViaPartner(
	provider: ethers.providers.JsonRpcProvider,
	partnerContractAddress: string,
	partnerAddress: string,
	vaultAddress: string,
	amount: ethers.BigNumber,
	gasLimit?: number
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(partnerContractAddress, PARTNER_VAULT_ABI, signer);
	const result = await handleTx(contract.deposit(vaultAddress, partnerAddress || process.env.PARTNER_ID_ADDRESS, amount, (gasLimit && gasLimit >= 0) ? {gasLimit} : {}));
	if (gasLimit !== -1 && result.error && hasCode(result.error)) {
		const	errorCode = result.error?.code;
		if (errorCode === 'UNPREDICTABLE_GAS_LIMIT') {
			return depositViaPartner(
				provider,
				partnerContractAddress,
				partnerAddress,
				vaultAddress,
				amount,
				gasLimit ? 300_000 : -1
			);
		}
	}
	return result;
}

function hasCode(error: Error | unknown): error is { code: string} {
	return (error as { code: string}).code !== undefined;
}
