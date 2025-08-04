import type {TCTA} from '@lib/components/yToast';
import {toast} from '@lib/components/yToast';
import type {Client, Hash, SimulateContractParameters, WalletClient} from 'viem';
import {BaseError} from 'viem';
import type {Connector} from 'wagmi';
import {
	getConnectorClient,
	simulateContract,
	switchChain,
	waitForTransactionReceipt,
	writeContract
} from 'wagmi/actions';
import type {TAddress} from '../../types/address';
import {assert, assertAddress} from '../assert';
import {toBigInt} from '../format';
import {toAddress} from '../tools.address';
import {retrieveConfig} from './config';
import type {TTxResponse} from './transaction';
import {defaultTxStatus} from './transaction';

interface WindowWithCustomEthereum extends Window {
	ethereum?: {
		useForknetForMainnet?: boolean;
	};
}

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
	txHashHandler?: (txHash: Hash) => void;
	onTrySomethingElse?: () => Promise<TTxResponse>; //When the abi is incorrect, ex: usdt, we may need to bypass the error and try something else
	shouldDisplaySuccessToast?: boolean;
	shouldDisplayErrorToast?: boolean;
	shouldResetStatus?: boolean;
	cta?: TCTA;
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
	if ((window as WindowWithCustomEthereum).ethereum?.useForknetForMainnet) {
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
			toast({content: error.shortMessage, type: 'error', cta: args.cta, duration: 8000});
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
		args.txHashHandler?.(hash);
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
			toast({content: 'Transaction successful!', type: 'success', cta: args.cta, duration: 8000});
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
			toast({content: error.shortMessage, type: 'error', cta: args.cta, duration: 8000});
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
