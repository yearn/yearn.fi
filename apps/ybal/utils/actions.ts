import {captureException} from '@sentry/nextjs';
import {prepareWriteContract, readContract, waitForTransaction, writeContract} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {BaseError} from 'viem';
import type {TAddressWagmi} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

const ZAP_ABI = [{'inputs':[{'name':'_input_token', 'type':'address'}, {'name':'_output_token', 'type':'address'}, {'name':'_amount_in', 'type':'uint256'}, {'name':'_min_out', 'type':'uint256'}, {'name':'_recipient', 'type':'address'}, {'name':'_mint', 'type':'bool'}], 'name':'zap', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'mint_buffer', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'name':'_input_token', 'type':'address'}, {'name':'_output_token', 'type':'address'}, {'name':'_amount_in', 'type':'uint256'}, {'name':'_mint', 'type':'bool'}], 'name':'queryZapOutput', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}] as const;

const LOCAL_ZAP_YEARN_YBAL_ADDRESS = toAddress('0x43cA9bAe8dF108684E5EAaA720C25e1b32B0A075');
const OUTPUT_TOKENS = [YBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS];

type TSimulateZapForMinOut = TWriteTransaction & {
	inputToken: TAddressWagmi,
	outputToken: TAddressWagmi,
	amountIn: bigint
};
export async function simulateZapForMinOut(props: TSimulateZapForMinOut): Promise<{shouldMint: boolean, minOut: bigint}> {
	if (props.amountIn === 0n) {
		return ({shouldMint: false, minOut: 0n});
	}

	try {
		const wagmiProvider = await toWagmiProvider(props.connector);
		const baseContract = {...wagmiProvider, address: LOCAL_ZAP_YEARN_YBAL_ADDRESS, abi: ZAP_ABI};
		const {result: expectedAmountMint} = await prepareWriteContract({
			...baseContract,
			functionName: 'queryZapOutput',
			args: [props.inputToken, props.outputToken, props.amountIn, true]
		});

		// Check if we even need to worry about minting path.
		let expectedAmountSwap = expectedAmountMint;
		if (!OUTPUT_TOKENS.includes(toAddress(props.inputToken))) {
			// Do another Static Call - simulating output
			const {result} = await prepareWriteContract({
				...baseContract,
				functionName: 'queryZapOutput',
				args: [props.inputToken, props.outputToken, props.amountIn, false]
			});
			expectedAmountSwap = result;
		}

		// Apply Buffer
		const slippage = 1; // (1%)
		const buffer = await readContract({
			...baseContract,
			functionName: 'mint_buffer'
		});
		const amountInBuffered = props.amountIn * buffer / 10_000n;
		const bufferedAmount = expectedAmountSwap - amountInBuffered;

		if (bufferedAmount > expectedAmountMint) {
			const minOut = bufferedAmount * (1n - (toBigInt(slippage) / 100n));
			return ({shouldMint: false, minOut});
		}
		const minOut = expectedAmountMint * (1n - (toBigInt(slippage) / 100n));
		return ({shouldMint: true, minOut});
	} catch (error) {
		console.error(error);
		return ({shouldMint: false, minOut: 0n});
	}
}

/* 🔵 - Yearn Finance **********************************************************
** zapBal is a _WRITE_ function that can be used to zap some supported tokens
** from the Balancer ecosystem into one of the Yearn's yBal ecosystem.
**
** @app - yBal
** @param inputToken - Token to be zapped from Balancer
** @param outputToken - Token to be zapped into Yearn's yBal ecosystem
** @param amount - Amount of inputToken to be zapped
** @param minAmount - Minimum amount of outputToken to be received
** @param slippage - Slippage tolerance
******************************************************************************/
type TZapYBal = TWriteTransaction & {
	inputToken: TAddressWagmi;
	outputToken: TAddressWagmi;
	amount: bigint;
	minAmount: bigint;
	slippage: bigint;
	shouldMint: boolean;
};
export async function zapBal(props: TZapYBal): Promise<TTxResponse> {
	assertAddress(LOCAL_ZAP_YEARN_YBAL_ADDRESS);
	assertAddress(props.contractAddress);
	assertAddress(props.inputToken);
	assertAddress(props.outputToken);
	assert(props.amount > 0n, 'Amount must be greater than 0');
	assert(props.minAmount > 0n, 'Min amount must be greater than 0');
	assert(props.minAmount <= props.amount, 'Min amount must be less than amount');

	const minAmountWithSlippage = props.minAmount * (1n - (props.slippage / 100n));
	assert(props.amount >= minAmountWithSlippage, 'Amount must be greater than min amount with slippage');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: LOCAL_ZAP_YEARN_YBAL_ADDRESS,
			abi: ZAP_ABI,
			functionName: 'zap',
			args: [
				props.inputToken,
				props.outputToken,
				props.amount,
				minAmountWithSlippage,
				wagmiProvider.address,
				props.shouldMint
			]
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
}
