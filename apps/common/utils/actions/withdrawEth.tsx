import {ethers} from 'ethers';
import ZAP_ETH_TO_YVETH_ABI from '@common/utils/abi/zapEthToYvEth.abi';
import {ZAP_ETH_WETH_CONTRACT} from '@common/utils/constants';

import type {ContractInterface} from 'ethers';

export async function	withdrawETH(
	provider: ethers.providers.Web3Provider,
	amount: ethers.BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			ZAP_ETH_WETH_CONTRACT,
			ZAP_ETH_TO_YVETH_ABI as ContractInterface,
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