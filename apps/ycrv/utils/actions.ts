import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx} from '@common/utils/toWagmiProvider';
import ZAP_CRV_ABI from '@yCRV/utils/abi/zapCRV.abi';

import type {TAddress} from '@yearn-finance/web-lib/types';
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
	inputToken: TAddress | undefined;
	outputToken: TAddress | undefined;
	amount: bigint;
	minAmount: bigint;
	slippage: bigint;
};
export async function zapCRV(props: TZapYCRV): Promise<TTxResponse> {
	const minAmountWithSlippage = (
		props.minAmount - (props.minAmount * props.slippage / 10_000n)
	);

	assertAddress(ZAP_YEARN_VE_CRV_ADDRESS, 'ZAP_YEARN_VE_CRV_ADDRESS');
	assertAddress(props.inputToken, 'inputToken');
	assertAddress(props.outputToken, 'outputToken');
	assert(props.amount > 0n, 'Amount must be greater than 0');
	assert(props.minAmount > 0n, 'Min amount must be greater than 0');

	return await handleTx(props, {
		address: ZAP_YEARN_VE_CRV_ADDRESS,
		abi: ZAP_CRV_ABI,
		functionName: 'zap',
		args: [
			props.inputToken,
			props.outputToken,
			props.amount,
			minAmountWithSlippage
		]
	});
}
