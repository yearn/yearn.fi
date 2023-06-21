import {prepareWriteContract, readContract} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx, toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

const ZAP_BAL_ABI = [{'inputs':[{'name':'_input_token', 'type':'address'}, {'name':'_output_token', 'type':'address'}, {'name':'_amount_in', 'type':'uint256'}, {'name':'_min_out', 'type':'uint256'}, {'name':'_recipient', 'type':'address'}, {'name':'_mint', 'type':'bool'}], 'name':'zap', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'mint_buffer', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'name':'_input_token', 'type':'address'}, {'name':'_output_token', 'type':'address'}, {'name':'_amount_in', 'type':'uint256'}, {'name':'_mint', 'type':'bool'}], 'name':'queryZapOutput', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}] as const;

const LOCAL_ZAP_YEARN_YBAL_ADDRESS = toAddress('0x43cA9bAe8dF108684E5EAaA720C25e1b32B0A075');
const OUTPUT_TOKENS = [YBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS];

type TSimulateZapForMinOut = TWriteTransaction & {
	inputToken: TAddress,
	outputToken: TAddress,
	amountIn: bigint
};
export async function simulateZapForMinOut(props: TSimulateZapForMinOut): Promise<{shouldMint: boolean, minOut: bigint}> {
	if (isZero(props.amountIn)) {
		return ({shouldMint: false, minOut: 0n});
	}

	try {
		const wagmiProvider = await toWagmiProvider(props.connector);
		const baseContract = {...wagmiProvider, address: LOCAL_ZAP_YEARN_YBAL_ADDRESS, abi: ZAP_BAL_ABI};
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
	inputToken: TAddress | undefined;
	outputToken: TAddress | undefined;
	amount: bigint;
	minAmount: bigint;
	slippage: bigint;
	shouldMint: boolean;
};
export async function zapBal(props: TZapYBal): Promise<TTxResponse> {
	const minAmountWithSlippage = (
		props.minAmount - (props.minAmount * props.slippage / 10_000n)
	);

	assert(props.connector, 'No connector');
	assertAddress(LOCAL_ZAP_YEARN_YBAL_ADDRESS, 'LOCAL_ZAP_YEARN_YBAL_ADDRESS');
	assertAddress(props.inputToken, 'inputToken');
	assertAddress(props.outputToken, 'outputToken');
	assert(props.amount > 0n, 'Amount must be greater than 0');
	assert(props.minAmount > 0n, 'Min amount must be greater than 0');

	const userAddress = await props.connector.getAccount();
	assertAddress(userAddress, 'userAddress');
	return await handleTx(props, {
		address: LOCAL_ZAP_YEARN_YBAL_ADDRESS,
		abi: ZAP_BAL_ABI,
		functionName: 'zap',
		args: [
			props.inputToken,
			props.outputToken,
			props.amount,
			minAmountWithSlippage,
			userAddress,
			props.shouldMint
		]
	});
}
