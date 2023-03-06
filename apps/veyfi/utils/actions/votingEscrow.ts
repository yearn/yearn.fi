import {ethers} from 'ethers';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import VEYFI_ABI from '../abi/veYFI.abi';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function approveLock(
	provider: TWeb3Provider,
	_accountAddress: TAddress,
	tokenAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount?: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(tokenAddress, ['function approve(address _spender, uint256 _value) external'], signer);
	return await handleTx(contract.approve(votingEscrowAddress, amount));
}

export async function lock(
	provider: TWeb3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: bigint,
	time: TSeconds
): Promise<TTxResponse> {
	const signer = await provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock(amount, time, accountAddress));
}

export async function increaseLockAmount(
	provider: TWeb3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: bigint
): Promise<TTxResponse> {
	const signer = await provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock(amount, '0', accountAddress));
}

export async function extendLockTime(
	provider: TWeb3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	time: TSeconds
): Promise<TTxResponse> {
	const signer = await provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock('0', time, accountAddress));
}

export async function withdrawUnlocked(
	provider: TWeb3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<TTxResponse> {
	const signer = await provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	const {penalty} = await votingEscrowContract.withdraw.staticCall();
	if (formatBN(penalty) > 0) {
		throw new Error('Tokens are not yet unlocked');
	}
	return await handleTx(votingEscrowContract.withdraw());
}

export async function withdrawLocked(
	provider: TWeb3Provider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<TTxResponse> {
	const signer = await provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.withdraw());
}
