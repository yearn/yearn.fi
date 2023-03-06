import	{ethers} from 'ethers';
import {getEthZapperContract} from '@vaults/utils';
import ZAP_ETH_TO_YVETH_ABI from '@yearn-finance/web-lib/utils/abi/zapEthToYvEth.abi';
import ZAP_FTM_TO_YVFTM_ABI from '@yearn-finance/web-lib/utils/abi/zapFtmToYvFTM.abi';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {ContractInterface} from 'ethers';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	depositETH(
	provider: ethers.providers.JsonRpcProvider,
	chainID: number,
	amount: ethers.BigNumber
): Promise<TTxResponse> {
	const	signer = provider.getSigner();
	const	contractAddress = getEthZapperContract(chainID);
	let		contractABI = ZAP_ETH_TO_YVETH_ABI as ContractInterface;
	if (chainID === 250) {
		contractABI = ZAP_FTM_TO_YVFTM_ABI as ContractInterface;
	}

	const contract = new ethers.Contract(contractAddress, contractABI, signer);
	return await handleTx(contract.deposit({value: amount}));
}
