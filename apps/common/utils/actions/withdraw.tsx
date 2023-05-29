import {getEthZapperContract} from '@vaults/utils';
import {prepareWriteContract} from '@wagmi/core';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import ZAP_ETH_TO_YVETH_ABI from '@yearn-finance/web-lib/utils/abi/zapEthToYvEth.abi';
import ZAP_FTM_TO_YVFTM_ABI from '@yearn-finance/web-lib/utils/abi/zapFtmToYvFTM.abi';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {toWagmiProvider, writeContract} from '@common/utils/toWagmiProvider';

import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function withdrawShares(
	connector: Connector,
	vaultAddress: TAddress,
	maxShares: bigint
): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(connector);
	const config = await prepareWriteContract({
		...wagmiProvider,
		address: toWagmiAddress(vaultAddress),
		abi: VAULT_ABI,
		functionName: 'withdraw',
		args: [maxShares]
	});
	return await writeContract(config);
}

export async function withdrawETH(
	connector: Connector,
	amount: bigint
): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(connector);
	const contractAddress = getEthZapperContract(wagmiProvider.chainId);

	if (wagmiProvider.chainId === 250) {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(contractAddress),
			abi: ZAP_FTM_TO_YVFTM_ABI,
			functionName: 'withdraw',
			args: [amount]
		});
		return await writeContract(config);
	}
	const config = await prepareWriteContract({
		...wagmiProvider,
		address: toWagmiAddress(contractAddress),
		abi: ZAP_ETH_TO_YVETH_ABI,
		functionName: 'withdraw',
		args: [amount]
	});
	return await writeContract(config);
}
