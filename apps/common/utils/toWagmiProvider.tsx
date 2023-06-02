import {captureException} from '@sentry/nextjs';
import {prepareWriteContract, waitForTransaction, writeContract} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';

import type {BaseError} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {GetWalletClientResult} from '@wagmi/core';

export type TWagmiProviderContract = {
	walletClient: GetWalletClientResult,
	chainId: number,
	address: TAddress,
}
export async function toWagmiProvider(connector: Connector | undefined): Promise<TWagmiProviderContract> {
	assert(connector, 'Connector is not set');

	const signer = await connector.getWalletClient();
	const chainId = await connector.getChainId();
	const {address} = signer.account;
	return ({
		walletClient: signer,
		chainId,
		address
	});
}

export type TWriteTransaction = {
	connector: Connector | undefined;
	contractAddress: TAddress | undefined;
	statusHandler?: (status: typeof defaultTxStatus) => void;
}

export function assertAddress(addr: string | TAddress | undefined, name?: string): asserts addr is TAddress {
	assert(addr, `${name || 'Address'} is not set`);
	assert(isTAddress(addr), `${name || 'Address'} provided is invalid`);
	assert(toAddress(addr) !== ZERO_ADDRESS, `${name || 'Address'} is 0x0`);
	assert(toAddress(addr) !== ETH_TOKEN_ADDRESS, `${name || 'Address'} is 0xE`);
}

type TPrepareWriteContractProp = Parameters<typeof prepareWriteContract>[0];

export async function handleTx(
	args: TWriteTransaction,
	props: Omit<TPrepareWriteContractProp, 'value'> & { value?: bigint; }
): Promise<TTxResponse> {
	args.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(args.connector);

	assertAddress(props.address, 'contractAddress');
	assertAddress(wagmiProvider.address, 'userAddress');
	try {
		const {request} = await prepareWriteContract({
			...wagmiProvider,
			...props,
			address: props.address,
			value: undefined
		});
		const {hash} = await writeContract(request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			args.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			args.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		if (process.env.NODE_ENV === 'production') {
			captureException(errorAsBaseError);
		}
		args.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			args.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
}
