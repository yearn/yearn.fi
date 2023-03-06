import	{ethers} from 'ethers';
import {getEthZapperContract} from '@vaults/utils';
import ZAP_ETH_TO_YVETH_ABI from '@yearn-finance/web-lib/utils/abi/zapEthToYvEth.abi';
import ZAP_FTM_TO_YVFTM_ABI from '@yearn-finance/web-lib/utils/abi/zapFtmToYvFTM.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	depositETH(
	provider: TWeb3Provider,
	chainID: number,
	amount: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contractAddress = getEthZapperContract(chainID);
	let	contractABI = ZAP_ETH_TO_YVETH_ABI as never;
	if (chainID === 250) {
		contractABI = ZAP_FTM_TO_YVFTM_ABI as never;
	}

	const contract = new ethers.Contract(contractAddress, contractABI, signer);
	return await handleTx(contract.deposit({value: amount}));
}
