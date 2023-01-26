import {ethers} from 'ethers';
import {approveERC20} from '@common/utils/actions/approveToken';

import STAKING_REWARDS_ABI from '../abi/stakingRewards.abi';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';


// TODO: move to common utils
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

export async function approveStake(
	provider: ethers.providers.Web3Provider,
	_accountAddress: TAddress,
	vaultAddress: TAddress,
	stakingAddress: TAddress,
	amount?: BigNumber
): Promise<boolean> {
	return approveERC20(provider, vaultAddress, stakingAddress, amount);
}

export async function stake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	stakingAddress: TAddress,
	amount: BigNumber
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsContract = new ethers.Contract(stakingAddress, STAKING_REWARDS_ABI, signer);
	return handleTx(stakingRewardsContract.stake(amount));
}

export async function unstake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	stakingAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsContract = new ethers.Contract(stakingAddress, STAKING_REWARDS_ABI, signer);
	return handleTx(stakingRewardsContract.exit());
}

export async function claim(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	stakingAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsContract = new ethers.Contract(stakingAddress, STAKING_REWARDS_ABI, signer);
	return handleTx(stakingRewardsContract.getReward());
}
