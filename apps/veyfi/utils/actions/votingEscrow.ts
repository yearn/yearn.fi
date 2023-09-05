import {stringToHex} from 'viem';
import {SNAPSHOT_DELEGATE_REGISTRY_ABI} from '@veYFI/utils/abi/SnapshotDelegateRegistry.abi';
import {VEYFI_ABI} from '@veYFI/utils/abi/veYFI.abi';
import {YEARN_SNAPSHOT_SPACE} from '@veYFI/utils/constants';
import {prepareWriteContract} from '@wagmi/core';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {assert} from '@common/utils/assert';
import {assertAddresses, handleTx as handleTxWagmi} from '@common/utils/wagmiUtils';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/wagmiUtils';

type TApproveLock = TWriteTransaction & {votingEscrowAddress: TAddress; amount: bigint;};
export async function approveLock(props: TApproveLock): Promise<TTxResponse> {
	const {votingEscrowAddress, amount = MAX_UINT_256, contractAddress} = props;

	assertAddresses([votingEscrowAddress, contractAddress]);
	assert(amount > 0n, 'Amount is 0');

	return await handleTxWagmi(props, {
		address: contractAddress,
		abi: ['function approve(address _spender, uint256 _value) external'],
		functionName: 'approve',
		args: [votingEscrowAddress, amount]
	});
}

type TLock = TWriteTransaction & {votingEscrowAddress: TAddress; accountAddress: TAddress; amount: bigint; time: TSeconds};
export async function lock(props: TLock): Promise<TTxResponse> {
	assertAddresses([props.votingEscrowAddress, props.accountAddress, props.contractAddress]);
	assert(props.amount > 0n, 'Amount is 0');
	assert(props.time > 0, 'Time is 0');

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [props.amount, toBigInt(props.time), props.accountAddress]
	});
}

type TIncreaseLockAmount = TWriteTransaction & {votingEscrowAddress: TAddress; accountAddress: TAddress; amount: bigint};
export async function increaseLockAmount(props: TIncreaseLockAmount): Promise<TTxResponse> {
	assertAddresses([props.votingEscrowAddress, props.accountAddress, props.contractAddress]);
	assert(props.amount > 0n, 'Amount is 0');

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [props.amount, 0n, props.accountAddress]
	});
}

type TExtendLockTime = TWriteTransaction & {votingEscrowAddress: TAddress; accountAddress: TAddress; time: TSeconds};
export async function extendLockTime(props: TExtendLockTime): Promise<TTxResponse> {
	assertAddresses([props.votingEscrowAddress, props.accountAddress, props.contractAddress]);
	assert(props.time > 0, 'Time is 0');

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'modify_lock',
		args: [0n, toBigInt(props.time), props.accountAddress]
	});
}

type TWithdrawUnlocked = TWriteTransaction & {votingEscrowAddress: TAddress};
export async function withdrawUnlocked(props: TWithdrawUnlocked): Promise<TTxResponse> {
	assertAddresses([props.votingEscrowAddress, props.contractAddress]);

	const {result} = await prepareWriteContract({
		address: props.votingEscrowAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});

	if (result.penalty > 0n) {
		throw new Error('Tokens are not yet unlocked');
	}

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});
}

type TWithdrawLocked = TWriteTransaction & {votingEscrowAddress: TAddress};
export async function withdrawLocked(props: TWithdrawLocked): Promise<TTxResponse> {
	assertAddresses([props.votingEscrowAddress, props.contractAddress]);

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_ABI,
		functionName: 'withdraw'
	});
}

type TDelegateVote = TWriteTransaction & {delegateAddress: TAddress};
export async function delegateVote(props: TDelegateVote): Promise<TTxResponse> {
	assertAddresses([props.delegateAddress, props.contractAddress]);

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: SNAPSHOT_DELEGATE_REGISTRY_ABI,
		functionName: 'setDelegate',
		args: [stringToHex(YEARN_SNAPSHOT_SPACE, {size: 32}), props.delegateAddress]
	});
}
