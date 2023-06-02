import {CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx} from '@common/utils/toWagmiProvider';
import CURVE_BRIBE_V3_ABI from '@yBribe/utils/abi/curveBribeV3.abi';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

/* 🔵 - Yearn Finance **********************************************************
** claimReward is a _WRITE_ function that claims the rewards from the yBribe
** contract.
**
** @app - yBribe
** @param gaugeAddress - The address of the gauge to claim rewards from.
** @param tokenAddress - The address of the token to claim rewards from.
******************************************************************************/
type TClaimReward = TWriteTransaction & {
	gaugeAddress: TAddress | undefined;
	tokenAddress: TAddress | undefined;
};
export async function claimRewardV3(props: TClaimReward): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assertAddress(CURVE_BRIBE_V3_ADDRESS, 'CURVE_BRIBE_V3_ADDRESS');
	assertAddress(props.gaugeAddress, 'gaugeAddress');
	assertAddress(props.tokenAddress, 'tokenAddress');

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: CURVE_BRIBE_V3_ADDRESS,
		abi: CURVE_BRIBE_V3_ABI,
		functionName: 'claim_reward_for',
		args: [signerAddress, props.gaugeAddress, props.tokenAddress]
	});
}


/* 🔵 - Yearn Finance **********************************************************
** claimReward is a _WRITE_ function that claims the rewards from the yBribe
** contract.
** The correct function for V2 or V3 should be used.
**
** @app - yBribe
** @param gaugeAddress - The address of the gauge to claim rewards from.
** @param tokenAddress - The address of the token to claim rewards from.
******************************************************************************/
type TAddReward = TWriteTransaction & {
	gaugeAddress: TAddress | undefined;
	tokenAddress: TAddress | undefined;
	amount: bigint;
};
export async function addReward(props: TAddReward): Promise<TTxResponse> {
	assertAddress(CURVE_BRIBE_V3_ADDRESS, 'CURVE_BRIBE_V3_ADDRESS');
	assertAddress(props.gaugeAddress, 'gaugeAddress');
	assertAddress(props.tokenAddress, 'tokenAddress');
	assert(props.amount > 0n, 'Amount must be greater than 0');

	return await handleTx(props, {
		address: CURVE_BRIBE_V3_ADDRESS,
		abi: CURVE_BRIBE_V3_ABI,
		functionName: 'add_reward_amount',
		args: [props.gaugeAddress, props.tokenAddress, props.amount]
	});
}
