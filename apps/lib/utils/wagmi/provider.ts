import {toast} from 'react-hot-toast';
import {BaseError} from 'viem';
import {getConnectorClient, simulateContract, switchChain, waitForTransactionReceipt, writeContract} from 'wagmi/actions';

import {assert, assertAddress} from '../assert';
import {toBigInt} from '../format';
import {toAddress} from '../tools.address';
import {retrieveConfig} from './config';
import {defaultTxStatus} from './transaction';

import type {Client, SimulateContractParameters, WalletClient} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress} from '../../types/address';
import type {TTxResponse} from './transaction';

export type TWagmiProviderContract = {
	walletClient: Client;
	chainId: number;
	address: TAddress;
};
export async function toWagmiProvider(connector: Connector | undefined): Promise<TWagmiProviderContract> {
	assert(connector, 'Connector is not set');
	if (!connector) {
		throw new Error('Connector is not set');
	}

	const chainId = await connector.getChainId();
	const [address] = await connector.getAccounts();
	const signer = await getConnectorClient(retrieveConfig());
	if (signer) {
		return {
			walletClient: signer,
			chainId,
			address: toAddress(address)
		};
	}
	throw new Error('Connector does not have a getClient method');
}

export type TWriteTransaction = {
	chainID: number;
	connector: Connector | undefined;
	contractAddress: TAddress | undefined;
	statusHandler?: (status: typeof defaultTxStatus) => void;
	onTrySomethingElse?: () => Promise<TTxResponse>; //When the abi is incorrect, ex: usdt, we may need to bypass the error and try something else
	shouldDisplaySuccessToast?: boolean;
	shouldDisplayErrorToast?: boolean;
	shouldResetStatus?: boolean;
};

type TPrepareWriteContractConfig = SimulateContractParameters & {
	chainId?: number;
	walletClient?: WalletClient;
	address: TAddress | undefined;
	confirmation?: number;
};
export async function handleTx(args: TWriteTransaction, props: TPrepareWriteContractConfig): Promise<TTxResponse> {
	const {shouldResetStatus = true} = args;

	const config = retrieveConfig();
	args.statusHandler?.({...defaultTxStatus, pending: true});
	let wagmiProvider = await toWagmiProvider(args.connector);

	// Use debug mode
	if ((window as any).ethereum.useForknetForMainnet) {
		if (args.chainID === 1) {
			args.chainID = 1337;
		}
	}

	/*******************************************************************************************
	 ** First, make sure we are using the correct chainID.
	 ******************************************************************************************/
	if (wagmiProvider.chainId !== args.chainID) {
		try {
			await switchChain(config, {chainId: args.chainID});
		} catch (error) {
			if (!(error instanceof BaseError)) {
				return {isSuccessful: false, error};
			}
			toast.error(error.shortMessage);
			args.statusHandler?.({...defaultTxStatus, error: true});
			console.error(error);
			return {isSuccessful: false, error};
		}
	}

	/*******************************************************************************************
	 ** Prepare the write contract.
	 ******************************************************************************************/
	wagmiProvider = await toWagmiProvider(args.connector);
	assertAddress(props.address, 'contractAddress');
	assertAddress(wagmiProvider.address, 'userAddress');
	assert(wagmiProvider.chainId === args.chainID, 'ChainID mismatch');
	try {
		const simulateContractConfig = await simulateContract(config, {
			...wagmiProvider,
			...(props as SimulateContractParameters),
			address: props.address,
			value: toBigInt(props.value)
		});
		const hash = await writeContract(config, simulateContractConfig.request);
		const receipt = await waitForTransactionReceipt(config, {
			chainId: wagmiProvider.chainId,
			hash,
			confirmations: props.confirmation || 2
		});

		if (receipt.status === 'success') {
			args.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			args.statusHandler?.({...defaultTxStatus, error: true});
		}
		// If shouldDisplaySuccessToast is undefined, we display the toast by default
		if (args.shouldDisplaySuccessToast || args.shouldDisplaySuccessToast === undefined) {
			toast.success('Transaction successful!');
		}
		return {isSuccessful: receipt.status === 'success', receipt};
	} catch (error) {
		if (!(error instanceof BaseError)) {
			return {isSuccessful: false, error};
		}

		if (args.onTrySomethingElse) {
			if (
				error.name === 'ContractFunctionExecutionError' &&
				error.shortMessage !== 'User rejected the request.' // We need this because for Arbitrum, rejection is a ContractFunctionExecutionError
			) {
				return await args.onTrySomethingElse();
			}
		}

		// If shouldDisplayErrorToast is undefined, we display the toast by default
		if (args.shouldDisplayErrorToast || args.shouldDisplayErrorToast === undefined) {
			toast.error(error.shortMessage);
		}
		args.statusHandler?.({...defaultTxStatus, error: true});
		console.error(error);
		return {isSuccessful: false, error};
	} finally {
		if (shouldResetStatus) {
			setTimeout((): void => {
				args.statusHandler?.({...defaultTxStatus});
			}, 3000);
		}
	}
}
