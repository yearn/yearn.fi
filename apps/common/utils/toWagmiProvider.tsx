import {captureException} from '@sentry/nextjs';
import {waitForTransaction, writeContract as wagmiWriteContract} from '@wagmi/core';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';

import type {BaseError} from 'viem';
import type {Connector} from 'wagmi';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {GetWalletClientResult, PrepareWriteContractResult} from '@wagmi/core';

export type TWagmiProviderContract = {
	walletClient: GetWalletClientResult,
	chainId: number,
	address: string,
}
export async function toWagmiProvider(connector: Connector): Promise<TWagmiProviderContract> {
	const signer = await connector.getWalletClient();
	const chainId = await connector.getChainId();
	const address = toWagmiAddress(signer.account.address);
	return ({
		walletClient: signer,
		chainId,
		address
	});
}

// PrepareWriteContractResult.request.value should be bigint instead of undefined

export async function writeContract(config: PrepareWriteContractResult): Promise<TTxResponse> {
	try {
		const {hash} = await wagmiWriteContract(config.request);
		const receipt = await waitForTransaction({chainId: config.request.chainId, hash});
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	}

}
