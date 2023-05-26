import {ethers} from 'ethers';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {BN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

const ZAP_ABI = [{'inputs':[{'name':'_input_token', 'type':'address'}, {'name':'_output_token', 'type':'address'}, {'name':'_amount_in', 'type':'uint256'}, {'name':'_min_out', 'type':'uint256'}, {'name':'_recipient', 'type':'address'}, {'name':'_mint', 'type':'bool'}], 'name':'zap', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}, {'inputs':[], 'name':'mint_buffer', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'view', 'type':'function'}, {'inputs':[{'name':'_input_token', 'type':'address'}, {'name':'_output_token', 'type':'address'}, {'name':'_amount_in', 'type':'uint256'}, {'name':'_mint', 'type':'bool'}], 'name':'queryZapOutput', 'outputs':[{'name':'', 'type':'uint256'}], 'stateMutability':'nonpayable', 'type':'function'}];

const LOCAL_ZAP_YEARN_YBAL_ADDRESS = toAddress('0x43cA9bAe8dF108684E5EAaA720C25e1b32B0A075');
const OUTPUT_TOKENS = [YBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, LPYBAL_TOKEN_ADDRESS];

export async function	simulateZapForMinOut(
	provider: ethers.providers.JsonRpcProvider,
	inputToken: TAddress,
	outputToken: TAddress,
	amountIn: BigNumber
): Promise<{shouldMint: boolean, minOut: BigNumber}> {
	if (amountIn.isZero()) {
		return ({shouldMint: false, minOut: BN(0)});
	}

	try {
		const signer = provider.getSigner();
		const contract = new ethers.Contract(LOCAL_ZAP_YEARN_YBAL_ADDRESS, ZAP_ABI, signer);

		// Static Call - simulating output
		const expectedAmountMint = await contract.callStatic.queryZapOutput(
			inputToken, // user supplied
			outputToken, // user supplied
			amountIn, // default=full input_token balace of user, unless specified
			true // mint
		) as BigNumber;

		// Check if we even need to worry about minting path.
		let expectedAmountSwap = expectedAmountMint;
		if (!OUTPUT_TOKENS.includes(inputToken)) {
			// Do another Static Call - simulating output
			expectedAmountSwap = await contract.callStatic.queryZapOutput(
				inputToken, // user supplied
				outputToken, // user supplied
				amountIn, // default=full input_token balace of user, unless specified
				false // mint
			) as BigNumber;
		}

		// Apply Buffer
		const slippage = 1; // (1%)
		const buffer = await contract.mint_buffer() as BigNumber;
		const amountInBuffered = amountIn.mul(buffer).div(10_000);
		const bufferedAmount = expectedAmountSwap.sub(amountInBuffered);

		if (bufferedAmount.gt(expectedAmountMint)) {
			const minOutStr = Number(ethers.utils.formatUnits(bufferedAmount, 18));
			const minOutWithSlippage = ethers.utils.parseUnits((minOutStr * (1 - (slippage / 100))).toFixed(18), 18);
			const minOut = minOutWithSlippage;
			return ({shouldMint: false, minOut});
		}
		const minOutStr = Number(ethers.utils.formatUnits(expectedAmountMint, 18));
		const minOutWithSlippage = ethers.utils.parseUnits((minOutStr * (1 - (slippage / 100))).toFixed(18), 18);
		const minOut = minOutWithSlippage;
		return ({shouldMint: true, minOut});
	} catch (error) {
		console.error(error);
		return ({shouldMint: false, minOut: BN(0)});
	}
}


export async function	zap(
	provider: ethers.providers.JsonRpcProvider,
	inputToken: string,
	outputToken: string,
	amountIn: BigNumber,
	minOut: BigNumber,
	slippage: number
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const address = await signer.getAddress();
	const contract = new ethers.Contract(LOCAL_ZAP_YEARN_YBAL_ADDRESS, ZAP_ABI, signer);
	const minOutStr = Number(ethers.utils.formatUnits(minOut, 18));
	const minOutWithSlippage = ethers.utils.parseUnits((minOutStr * (1 - (slippage / 100))).toFixed(18), 18);

	return await handleTx(contract.zap(
		inputToken, //_input_token
		outputToken, //_output_token
		amountIn, //_amount_in
		minOutWithSlippage, //_min_out
		address, //_recipient
		true //_mint
	));
}
