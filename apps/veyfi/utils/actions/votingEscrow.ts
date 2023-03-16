import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import SNAPSHOT_DELEGATE_REGISTRY_ABI from '../abi/SnapshotDelegateRegistry.abi';
import VEYFI_ABI from '../abi/veYFI.abi';
import {SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, YEARN_SNAPSHOT_SPACE} from '../constants';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function approveLock(
	provider: ethers.providers.JsonRpcProvider,
	_accountAddress: TAddress,
	tokenAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount = ethers.constants.MaxUint256
): Promise<TTxResponse> {
	const signer = provider.getSigner();
	const contract = new ethers.Contract(tokenAddress, ['function approve(address _spender, uint256 _value) external'], signer);
	return await handleTx(contract.approve(votingEscrowAddress, amount));
}

export async function lock(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: BigNumber,
	time: TSeconds
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock(amount, time, accountAddress));
}

export async function increaseLockAmount(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock(amount, '0', accountAddress));
}

export async function extendLockTime(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	time: TSeconds
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.modify_lock('0', time, accountAddress));
}

export async function withdrawUnlocked(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	const {penalty} = await votingEscrowContract.callStatic.withdraw();
	if ((penalty as BigNumber).gt(0)) {
		throw new Error('Tokens are not yet unlocked');
	}
	return await handleTx(votingEscrowContract.withdraw());
}

export async function withdrawLocked(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VEYFI_ABI, signer);
	return await handleTx(votingEscrowContract.withdraw());
}

export async function delegateVote(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	delegateAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const delegateRegistryContract = new ethers.Contract(SNAPSHOT_DELEGATE_REGISTRY_ADDRESS, SNAPSHOT_DELEGATE_REGISTRY_ABI, signer);
	return await handleTx(delegateRegistryContract.setDelegate(ethers.utils.formatBytes32String(YEARN_SNAPSHOT_SPACE), delegateAddress));
}
