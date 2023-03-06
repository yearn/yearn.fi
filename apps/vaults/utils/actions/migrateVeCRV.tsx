import {ethers} from 'ethers';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

const	ZAP_YEARN_VE_CRV_MIN_ABI = ['function zap(address _input, address _output, uint256 _amount) external returns (uint256)'];

export async function	zap(
	provider: TWeb3Provider,
	inputToken: string,
	outputToken: string,
	amount: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(ZAP_YEARN_VE_CRV_ADDRESS, ZAP_YEARN_VE_CRV_MIN_ABI, signer);
	return await handleTx(contract.zap(inputToken, outputToken, amount));
}
