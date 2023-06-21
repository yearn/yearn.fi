import {BaseError} from 'viem';
import VEYFI_ABI from '@veYFI/utils/abi/veYFI.abi';
import {prepareWriteContract} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx} from '@common/utils/toWagmiProvider';

import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

/* 🔵 - Yearn Finance **********************************************************
** lockVeYFI is a _WRITE_ function that locks funds in the veYFI contract in
** exchange of some voting power.
**
** @app - veYFI
** @param amount - The amount of the underlying asset to deposit.
** @param time - The amount of time to lock the funds for.
******************************************************************************/
type TLockVeYFI = TWriteTransaction & {
	amount: bigint;
	time: bigint
};
export async function lockVeYFI(props: TLockVeYFI): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.time > 0n, 'Time is 0');
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [props.amount, props.time, signerAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
** increaseVeYFILockAmount is a _WRITE_ function that increases the amount of
** funds locked in the veYFI contract in exchange of some voting power.
**
** @app - veYFI
** @param amount - The amount of the underlying asset to deposit.
******************************************************************************/
type TIncreaseVeYFILockAmount = TWriteTransaction & {
	amount: bigint;
};
export async function increaseVeYFILockAmount(props: TIncreaseVeYFILockAmount): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [props.amount, 0n, signerAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
** extendVeYFILockTime is a _WRITE_ function that increases the amount of time funds
** are locked in the veYFI contract in exchange of some voting power.
**
** @app - veYFI
** @param time - The amount of time to lock the funds for.
******************************************************************************/
type TExtendVeYFILockTime = TWriteTransaction & {
	time: bigint;
};
export async function extendVeYFILockTime(props: TExtendVeYFILockTime): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.time > 0n, 'Time is 0');
	assertAddress(props.contractAddress);

	const signerAddress = await props.connector.getAccount();
	assertAddress(signerAddress, 'signerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [0n, props.time, signerAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
** getVeYFIWithdrawPenalty is a _READ_ function that simulates a withdrawal from
** the veYFI contract and returns the penalty to be paid.
**
** @app - veYFI
******************************************************************************/
type TGetVeYFIWithdrawPenalty = TWriteTransaction;
export async function getVeYFIWithdrawPenalty(props: TGetVeYFIWithdrawPenalty): Promise<bigint> {
	try {
		const {result} = await prepareWriteContract({
			address: toAddress(props.contractAddress),
			abi: VEYFI_ABI,
			functionName: 'withdraw'
		});
		return result.penalty;
	} catch (error) {
		return 0n;
	}
}

/* 🔵 - Yearn Finance **********************************************************
** withdrawUnlockedVeYFI is a _WRITE_ function that withdraws unlocked funds from
** the veYFI contract.
** Note: will fail if there is a penalty to be paid.
**
** @app - veYFI
******************************************************************************/
type TWithdrawUnlockedVeYFI = TWriteTransaction;
export async function withdrawUnlockedVeYFI(props: TWithdrawUnlockedVeYFI): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const penalty = await getVeYFIWithdrawPenalty(props);
	if (penalty > 0n) {
		props.statusHandler?.({...defaultTxStatus, error: true});
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
		return ({isSuccessful: false, error: new BaseError('Tokens are not yet unlocked')});
	}

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});
}

/* 🔵 - Yearn Finance **********************************************************
** withdrawLockedVeYFI is a _WRITE_ function that withdraws locked funds from the
** veYFI contract.
**
** @app - veYFI
******************************************************************************/
type TWithdrawLockedVeYFI = TWriteTransaction;
export async function withdrawLockedVeYFI(props: TWithdrawLockedVeYFI): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});
}
