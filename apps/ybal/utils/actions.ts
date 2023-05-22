import {ethers} from 'ethers';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {BigNumber} from 'ethers';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	zap(
	provider: ethers.providers.JsonRpcProvider,
	inputToken: string,
	outputToken: string,
	amount: BigNumber,
	minAmount: BigNumber,
	slippage: number
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const address = await signer.getAddress();
	const contract = new ethers.Contract(
		ZAP_YEARN_VE_CRV_ADDRESS,
		['function zap(address _input, address _output, uint256 _amount, uint256 _minOut, address _recipient) external returns (uint256)'],
		signer
	);
	const minAmountStr = Number(ethers.utils.formatUnits(minAmount, 18));
	const minAmountWithSlippage = ethers.utils.parseUnits((minAmountStr * (1 - (slippage / 100))).toFixed(18), 18);
	return await handleTx(contract.zap(inputToken, outputToken, amount, minAmountWithSlippage, address));
}
