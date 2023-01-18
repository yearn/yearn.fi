import {ethers} from 'ethers';
import {approveERC20} from '@common/utils/actions';

import SNAPSHOT_DELEGATE_REGISTRY_ABI from '../abi/SnapshotDelegateRegistry.abi';
import VEYFI_ABI from '../abi/veYFI.abi';
import {SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, YEARN_SNAPSHOT_SPACE} from '../constants';
import {handleTx} from '..';

import type {BigNumber} from 'ethers';
import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';

export async function approveLock(
	provider: Connector,
	_accountAddress: TAddress,
	tokenAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount?: bigint
): Promise<boolean> {
	if (!amount) {
		return false;
	}

	const result = await approveERC20({
		connector: provider,
		contractAddress: tokenAddress,
		spenderAddress: votingEscrowAddress,
		amount
	});
	
	return result.isSuccessful;
}

export async function lock(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: BigNumber,
	time: TSeconds
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return handleTx(votingEscrowContract.modify_lock(amount, time, accountAddress));
}

export async function increaseLockAmount(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: BigNumber
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return handleTx(votingEscrowContract.modify_lock(amount, '0', accountAddress));
}

export async function extendLockTime(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	time: TSeconds
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return handleTx(votingEscrowContract.modify_lock('0', time, accountAddress));
}

export async function withdrawUnlocked(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	const {penalty} = await votingEscrowContract.callStatic.withdraw();
	if ((penalty as BigNumber).gt(0)) {
		throw new Error('Tokens are not yet unlocked');
	}
	return handleTx(votingEscrowContract.withdraw());
}

export async function withdrawLocked(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return handleTx(votingEscrowContract.withdraw());
}

export async function delegateVote(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	delegateAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const delegateRegistryContract = new ethers.Contract(SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, SNAPSHOT_DELEGATE_REGISTRY_ABI, signer);
	return handleTx(delegateRegistryContract.setDelegate(ethers.utils.formatBytes32String(YEARN_SNAPSHOT_SPACE), delegateAddress));
}
