import {captureException} from '@sentry/nextjs';
import {prepareWriteContract, waitForTransaction, writeContract} from '@wagmi/core';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';

import VEYFI_ABI from './abi/veYFI.abi';

import type {BaseError} from 'viem';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

/* 🔵 - Yearn Finance **********************************************************
** lock is a _WRITE_ function that locks funds in the veYFI contract in
** exchange of some voting power.
**
** @app - veYFI
** @param amount - The amount of the underlying asset to deposit.
** @param time - The amount of time to lock the funds for.
******************************************************************************/
type TLock = TWriteTransaction & {
	amount: bigint;
	time: bigint
};
export async function lock(props: TLock): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.time > 0n, 'Time is 0');
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: VEYFI_ABI,
			functionName: 'modify_lock',
			args: [props.amount, props.time, wagmiProvider.address]
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
** increaseLockAmount is a _WRITE_ function that increases the amount of funds
** locked in the veYFI contract in exchange of some voting power.
**
** @app - veYFI
** @param amount - The amount of the underlying asset to deposit.
******************************************************************************/
type TIncreaseLockAmount = TWriteTransaction & {
	amount: bigint;
};
export async function increaseLockAmount(props: TIncreaseLockAmount): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: VEYFI_ABI,
			functionName: 'modify_lock',
			args: [props.amount, 0n, wagmiProvider.address]
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
** extendLockTime is a _WRITE_ function that increases the amount of time funds
** are locked in the veYFI contract in exchange of some voting power.
**
** @app - veYFI
** @param time - The amount of time to lock the funds for.
******************************************************************************/
type TExtendLockTime = TWriteTransaction & {
	time: bigint;
};
export async function extendLockTime(props: TExtendLockTime): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.time > 0n, 'Time is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: VEYFI_ABI,
			functionName: 'modify_lock',
			args: [0n, props.time, wagmiProvider.address]
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
** withdrawUnlocked is a _WRITE_ function that withdraws unlocked funds from
** the veYFI contract.
** Note: will fail if there is a penalty to be paid.
**
** @app - veYFI
******************************************************************************/
type TWithdrawUnlocked = TWriteTransaction;
export async function withdrawUnlocked(props: TWithdrawUnlocked): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: VEYFI_ABI,
			functionName: 'withdraw'
		});
		if (config.result.penalty > 0n) {
			throw new Error('Tokens are not yet unlocked');
		}
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
** withdrawLocked is a _WRITE_ function that withdraws locked funds from the
** veYFI contract.
**
** @app - veYFI
******************************************************************************/
type TWithdrawLocked = TWriteTransaction;
export async function withdrawLocked(props: TWithdrawLocked): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: VEYFI_ABI,
			functionName: 'withdraw'
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
