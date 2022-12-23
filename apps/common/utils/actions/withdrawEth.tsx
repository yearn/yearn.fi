import {ethers} from 'ethers';
import {getEthZapperContract} from '@vaults/utils';
import {ZAP_ETH_TO_YVETH_ABI} from '@yearn-finance/web-lib/utils/abi';
import ZAP_FTM_TO_YVFTM_ABI from '@common/utils/abi/zapFtmToYvFTM.abi';

import type {ContractInterface} from 'ethers';

export async function	withdrawETH(
	provider: ethers.providers.Web3Provider,
	chainID: number,
	amount: ethers.BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contractAddress = getEthZapperContract(chainID);
		let		contractABI = ZAP_ETH_TO_YVETH_ABI as ContractInterface;
		if (chainID === 250) {
			contractABI = ZAP_FTM_TO_YVFTM_ABI as ContractInterface;
		}


		const	contract = new ethers.Contract(
			contractAddress,
			contractABI,
			signer
		);
		const	transaction = await contract.withdraw(amount);
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
