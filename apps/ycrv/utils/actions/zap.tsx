import {ethers} from 'ethers';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {BigNumber} from 'ethers';

export async function	zap(
	provider: ethers.providers.Web3Provider,
	inputToken: string,
	outputToken: string,
	amount: BigNumber,
	minAmount: BigNumber,
	slippage: number
): Promise<boolean> {
	const	signer = provider.getSigner();
	const	address = await signer.getAddress();

	try {
		const	contract = new ethers.Contract(
			ZAP_YEARN_VE_CRV_ADDRESS,
			['function zap(address _input, address _output, uint256 _amount, uint256 _minOut, address _recipient) external returns (uint256)'],
			signer
		);
		const	minAmountStr = Number(ethers.utils.formatUnits(minAmount, 18));
		const	minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
		const	transaction = await contract.zap(
			inputToken,
			outputToken,
			amount,
			minAmountWithSlippage,
			address
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
