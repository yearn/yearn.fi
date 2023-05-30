import {captureException} from '@sentry/nextjs';
import {waitForTransaction, writeContract as wagmiWriteContract} from '@wagmi/core';
import {isZeroAddress, toAddress, toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import {assert} from '@common/utils/assert';

import type {BaseError} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress, TAddressWagmi} from '@yearn-finance/web-lib/types';
import type {defaultTxStatus, TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
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

export type TWriteTransaction = {
	connector: Connector;
	contractAddress: TAddressWagmi;
	statusHandler?: (status: typeof defaultTxStatus) => void;
}

export function assertAddress(addr: string): asserts addr is TAddress {
	assert(isTAddress(addr), 'Address is not an address');
	assert(!isZeroAddress(addr), 'Address is address 0x0');
	assert(toAddress(addr) !== ETH_TOKEN_ADDRESS, 'Address is address 0xE');
}
