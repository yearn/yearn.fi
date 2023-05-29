import {getEthZapperContract} from '@vaults/utils';
import {prepareWriteContract} from '@wagmi/core';
import PARTNER_VAULT_ABI from '@yearn-finance/web-lib/utils/abi/partner.vault.abi';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import ZAP_ETH_TO_YVETH_ABI from '@yearn-finance/web-lib/utils/abi/zapEthToYvEth.abi';
import ZAP_FTM_TO_YVFTM_ABI from '@yearn-finance/web-lib/utils/abi/zapFtmToYvFTM.abi';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {toWagmiProvider, writeContract} from '@common/utils/toWagmiProvider';

import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function	deposit(
	connector: Connector,
	vaultAddress: TAddress,
	amount: bigint
): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(connector);
	const config = await prepareWriteContract({
		...wagmiProvider,
		address: toWagmiAddress(vaultAddress),
		abi: VAULT_ABI,
		functionName: 'deposit',
		args: [amount]
	});
	return await writeContract(config);
}

export async function	depositETH(
	connector: Connector,
	amount: bigint
): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(connector);
	if (wagmiProvider.chainId === 250) {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(getEthZapperContract(wagmiProvider.chainId)),
			abi: ZAP_FTM_TO_YVFTM_ABI,
			functionName: 'deposit',
			value: amount
		});
		// When using value, the PrepareWriteContractResult type looks broken. Bypass error.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return await writeContract(config as any);
	}
	const config = await prepareWriteContract({
		...wagmiProvider,
		address: toWagmiAddress(getEthZapperContract(wagmiProvider.chainId)),
		abi: ZAP_ETH_TO_YVETH_ABI,
		functionName: 'deposit',
		value: amount
	});
	// When using value, the PrepareWriteContractResult type looks broken. Bypass error.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return await writeContract(config as any);
}

export async function	depositViaPartner(
	connector: Connector,
	partnerContractAddress: TAddress,
	partnerAddress: TAddress,
	vaultAddress: TAddress,
	amount: bigint
): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(connector);
	const config = await prepareWriteContract({
		...wagmiProvider,
		address: toWagmiAddress(partnerContractAddress),
		abi: PARTNER_VAULT_ABI,
		functionName: 'deposit',
		args: [toWagmiAddress(vaultAddress), toWagmiAddress(partnerAddress || process.env.PARTNER_ID_ADDRESS), amount]
	});
	return await writeContract(config);
}
