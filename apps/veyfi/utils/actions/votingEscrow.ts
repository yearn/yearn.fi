import {ethers} from 'ethers';
import {approveERC20} from '@common/utils/actions/approveToken';

import VEYFI_ABI from '../abi/veYFI.abi';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';

const handleTx = async (txPromise: Promise<ethers.providers.TransactionResponse>): Promise<boolean> => {
	try {
		const tx = await txPromise;
		const receipt = await tx.wait();
		if (receipt.status === 0) {
			console.error('Fail to perform transaction');
			return false;
		}
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
};

export async function approveLock(
	provider: ethers.providers.Web3Provider,
	_accountAddress: TAddress,
	tokenAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount?: BigNumber
): Promise<boolean> {
	return await approveERC20(provider, tokenAddress, votingEscrowAddress, amount);
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
	return await handleTx(votingEscrowContract.modify_lock(amount, time, accountAddress));
}

export async function increaseLockAmount(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: BigNumber
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock(amount, '0', accountAddress));

}

export async function extendLockTime(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	time: TSeconds
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock('0', time, accountAddress));

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
	return await handleTx(votingEscrowContract.withdraw());

}

export async function withdrawLocked(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.withdraw());

}
