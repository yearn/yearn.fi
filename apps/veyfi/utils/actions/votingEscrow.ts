import {ethers} from 'ethers';
import {stringToHex} from 'viem';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assertAddresses, handleTx as handleTxWagmi} from '@common/utils/wagmiUtils';

import SNAPSHOT_DELEGATE_REGISTRY_ABI from '../abi/SnapshotDelegateRegistry.abi';
import VEYFI_ABI from '../abi/veYFI.abi';
import {YEARN_SNAPSHOT_SPACE} from '../constants';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/wagmiUtils';

export async function approveLock(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	tokenAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount = ethers.constants.MaxUint256
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const contract = new ethers.Contract(tokenAddress, ['function approve(address _spender, uint256 _value) external'], signer);
	return await handleTx(contract.approve(votingEscrowAddress, amount));
}

export async function lock(
	provider: ethers.providers.JsonRpcProvider,
	accountAddress: TAddress,
	votingEscrowAddress: TAddress,
	amount: bigint,
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
	amount: bigint
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
	if ((penalty as bigint) > 0n) {
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
