import {captureException} from '@sentry/nextjs';
import {prepareWriteContract, waitForTransaction, writeContract} from '@wagmi/core';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {isTAddress} from '@yearn-finance/web-lib/utils/isTAddress';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';

import type {Abi, BaseError, SimulateContractParameters} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {GetWalletClientResult, WalletClient} from '@wagmi/core';

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


type TPrepareWriteContractConfig<
	TAbi extends Abi | readonly unknown[] = Abi,
	TFunctionName extends string = string
> = Omit<SimulateContractParameters<TAbi, TFunctionName>, 'chain' | 'address'> & {
	chainId?: number
	walletClient?: WalletClient
	address: TAddress | undefined
}
export async function handleTx<
	TAbi extends Abi | readonly unknown[],
	TFunctionName extends string
>(
	args: TWriteTransaction,
	props: TPrepareWriteContractConfig<TAbi, TFunctionName>
): Promise<TTxResponse> {
	args.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(args.connector);

	assertAddress(props.address, 'contractAddress');
	assertAddress(wagmiProvider.address, 'userAddress');
	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			...props as TPrepareWriteContractConfig,
			address: props.address
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			args.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			args.statusHandler?.({...defaultTxStatus, error: true});
		}
		toast({type: 'success', content: 'Transaction successful!'});
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		if (process.env.NODE_ENV === 'production') {
			captureException(errorAsBaseError);
		}
		toast({type: 'error', content: errorAsBaseError.shortMessage});
		args.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			args.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
}
