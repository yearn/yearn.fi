import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';
import {approveERC20} from '@common/utils/actions';

import SNAPSHOT_DELEGATE_REGISTRY_ABI from '../abi/SnapshotDelegateRegistry.abi';
import VEYFI_ABI from '../abi/veYFI.abi';
import {SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, YEARN_SNAPSHOT_SPACE} from '../constants';

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
	const result = await handleTx(votingEscrowContract.modify_lock(amount, time, accountAddress));
	return result.isSuccessful;
}

export async function increaseLockAmount(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: BigNumber
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	const result = await (votingEscrowContract.modify_lock(amount, '0', accountAddress));
	return result.isSuccessful;
}

export async function extendLockTime(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	time: TSeconds
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	const result = await (votingEscrowContract.modify_lock('0', time, accountAddress));
	return result.isSuccessful;
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
	const result = await (votingEscrowContract.withdraw());
	return result.isSuccessful;
}

export async function withdrawLocked(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	const result = await (votingEscrowContract.withdraw());
	return result.isSuccessful;
}

export async function delegateVote(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	delegateAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const delegateRegistryContract = new ethers.Contract(SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, SNAPSHOT_DELEGATE_REGISTRY_ABI, signer);
	const result = await (delegateRegistryContract.setDelegate(ethers.utils.formatBytes32String(YEARN_SNAPSHOT_SPACE), delegateAddress));
	return result.isSuccessful;
}
