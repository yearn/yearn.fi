import {captureException} from '@sentry/nextjs';
import {prepareWriteContract, waitForTransaction, writeContract} from '@wagmi/core';
import {CURVE_BRIBE_V2_ADDRESS, CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';
import CURVE_BRIBE_V2_ABI from '@yBribe/utils/abi/curveBribeV2.abi';

import CURVE_BRIBE_V3_ABI from './abi/curveBribeV3.abi';

import type {BaseError} from 'viem';
import type {TAddressWagmi} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

/* 🔵 - Yearn Finance **********************************************************
** claimReward is a _WRITE_ function that claims the rewards from the yBribe
** contract.
** The correct function for V2 or V3 should be used.
**
** @app - yBribe
** @param gaugeAddress - The address of the gauge to claim rewards from.
** @param tokenAddress - The address of the token to claim rewards from.
******************************************************************************/
type TClaimReward = TWriteTransaction & {
	gaugeAddress: TAddressWagmi;
	tokenAddress: TAddressWagmi;
};
export async function claimRewardV2(props: TClaimReward): Promise<TTxResponse> {
	assertAddress(CURVE_BRIBE_V2_ADDRESS);
	assertAddress(props.contractAddress);
	assertAddress(props.gaugeAddress);
	assertAddress(props.tokenAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: CURVE_BRIBE_V2_ADDRESS,
			abi: CURVE_BRIBE_V2_ABI,
			functionName: 'claim_reward',
			args: [wagmiProvider.address, props.gaugeAddress, props.tokenAddress]
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

export async function claimRewardV3(props: TClaimReward): Promise<TTxResponse> {
	assertAddress(CURVE_BRIBE_V3_ADDRESS);
	assertAddress(props.contractAddress);
	assertAddress(props.gaugeAddress);
	assertAddress(props.tokenAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: CURVE_BRIBE_V3_ADDRESS,
			abi: CURVE_BRIBE_V3_ABI,
			functionName: 'claim_reward_for',
			args: [wagmiProvider.address, props.gaugeAddress, props.tokenAddress]
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
	gaugeAddress: TAddressWagmi;
	tokenAddress: TAddressWagmi;
	amount: bigint;
};
export async function addReward(props: TAddReward): Promise<TTxResponse> {
	assertAddress(CURVE_BRIBE_V3_ADDRESS);
	assertAddress(props.contractAddress);
	assertAddress(props.gaugeAddress);
	assertAddress(props.tokenAddress);
	assert(props.amount > 0n, 'Amount must be greater than 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: CURVE_BRIBE_V3_ADDRESS,
			abi: CURVE_BRIBE_V3_ABI,
			functionName: 'add_reward_amount',
			args: [props.gaugeAddress, props.tokenAddress, props.amount]
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
