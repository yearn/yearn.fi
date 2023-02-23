import {ethers} from 'ethers';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {BigNumber} from 'ethers';

export async function	zap(
	provider: ethers.providers.JsonRpcProvider,
	inputToken: string,
	outputToken: string,
	amount: BigNumber
): Promise<boolean> {
	const	signer = provider.getSigner();

	try {
		const	contract = new ethers.Contract(
			ZAP_YEARN_VE_CRV_ADDRESS,
			['function zap(address _input, address _output, uint256 _amount) external returns (uint256)'],
			signer
		);
		const	transaction = await contract.zap(
			inputToken,
			outputToken,
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
