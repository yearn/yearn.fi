import {ethers} from 'ethers';

import type {BigNumber} from 'ethers';

const VotingEscrowAbi = [
	'function locked(address arg0) public view returns (tuple(uint256 amount, uint256 end))',
	'function modify_lock(uint256 amount, uint256 unlock_time, address user) public returns (tuple(uint256 amount, uint256 end))',
	'function withdraw() public returns (tuple(uint256 amount, uint256 penalty))'
];

const TokenAbi = [
	'function approve(address _spender, uint256 _value) public',
	'function allowance(address _owner, address _spender) public view returns (uint256)'
];

export async function approveLock(
	provider: ethers.providers.Web3Provider,
	accountAddress: string,
	tokenAddress: string,
	votingEscrowAddress: string,
	amount?: string
): Promise<ethers.providers.TransactionResponse> {
	const signer = provider.getSigner(accountAddress);
	const tokenContract = new ethers.Contract(tokenAddress, TokenAbi, signer);
	return await tokenContract.approve(votingEscrowAddress, amount ?? ethers.constants.MaxUint256.toString());
}

export async function lock(
	provider: ethers.providers.Web3Provider,
	accountAddress: string,
	votingEscrowAddress: string,
	amount: string,
	time: number
): Promise<ethers.providers.TransactionResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VotingEscrowAbi, signer);
	return await votingEscrowContract.modify_lock(amount, time, accountAddress);
}

export async function increaseLockAmount(
	provider: ethers.providers.Web3Provider,
	accountAddress: string,
	votingEscrowAddress: string,
	amount: string
): Promise<ethers.providers.TransactionResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VotingEscrowAbi, signer);
	return await votingEscrowContract.modify_lock(amount, '0', accountAddress);

}

export async function extendLockTime(
	provider: ethers.providers.Web3Provider,
	accountAddress: string,
	votingEscrowAddress: string,
	time: number
): Promise<ethers.providers.TransactionResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VotingEscrowAbi, signer);
	return await votingEscrowContract.modify_lock('0', time, accountAddress);

}

export async function withdrawUnlocked(
	provider: ethers.providers.Web3Provider,
	accountAddress: string,
	votingEscrowAddress: string
): Promise<ethers.providers.TransactionResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VotingEscrowAbi, signer);
	const {penalty} = await votingEscrowContract.callStatic.withdraw();
	if ((penalty as BigNumber).gt(0)) {
		throw new Error('Tokens are not yet unlocked');
	}
	return await votingEscrowContract.withdraw();

}

export async function withdrawLocked(
	provider: ethers.providers.Web3Provider,
	accountAddress: string,
	votingEscrowAddress: string
): Promise<ethers.providers.TransactionResponse> {
	const signer = provider.getSigner(accountAddress);
	const votingEscrowContract = new ethers.Contract(votingEscrowAddress, VotingEscrowAbi, signer);
	return await votingEscrowContract.withdraw();

}
