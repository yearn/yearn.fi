import {captureException} from '@sentry/nextjs';
import {prepareWriteContract, waitForTransaction, writeContract} from '@wagmi/core';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';
import ZAP_CRV_ABI from '@yCRV/utils/abi/zapCRV.abi';

import type {BaseError} from 'viem';
import type {TAddressWagmi} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';


/* 🔵 - Yearn Finance **********************************************************
** zapCRV is a _WRITE_ function that can be used to zap some supported tokens
** from the Curve ecosystem into one of the Yearn's yCRV ecosystem.
**
** @app - yCRV
** @param inputToken - Token to be zapped from curve
** @param outputToken - Token to be zapped into Yearn's yCRV ecosystem
** @param amount - Amount of inputToken to be zapped
** @param minAmount - Minimum amount of outputToken to be received
** @param slippage - Slippage tolerance
******************************************************************************/
type TZapYCRV = TWriteTransaction & {
	inputToken: TAddressWagmi;
	outputToken: TAddressWagmi;
	amount: bigint;
	minAmount: bigint;
	slippage: bigint;
};
export async function zapCRV(props: TZapYCRV): Promise<TTxResponse> {
	assertAddress(ZAP_YEARN_VE_CRV_ADDRESS);
	assertAddress(props.contractAddress);
	assertAddress(props.inputToken);
	assertAddress(props.outputToken);
	assert(props.amount > 0n, 'Amount must be greater than 0');
	assert(props.minAmount > 0n, 'Min amount must be greater than 0');
	assert(props.minAmount <= props.amount, 'Min amount must be less than amount');

	const minAmountWithSlippage = props.minAmount * (1n - (props.slippage / 100n));
	assert(props.amount >= minAmountWithSlippage, 'Amount must be greater or equal to min amount with slippage');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: ZAP_YEARN_VE_CRV_ADDRESS,
			abi: ZAP_CRV_ABI,
			functionName: 'zap',
			args: [props.inputToken, props.outputToken, props.amount, minAmountWithSlippage]
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
