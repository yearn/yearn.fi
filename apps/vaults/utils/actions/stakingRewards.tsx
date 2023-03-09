import {ethers} from 'ethers';
import {STAKING_REWARDS_ZAP_ADDRESS} from '@vaults/constants';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';
import {approveERC20} from '@common/utils/actions/approveToken';

import STAKING_REWARDS_ABI from '../abi/stakingRewards.abi';
import STAKING_REWARDS_ZAP_ABI from '../abi/stakingRewardsZap.abi';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function approveStake(
	provider: ethers.providers.Web3Provider,
	_accountAddress: TAddress,
	vaultAddress: TAddress,
	stakingAddress: TAddress,
	amount?: BigNumber
): Promise<TTxResponse> {
	return approveERC20(provider, vaultAddress, stakingAddress, amount);
}

export async function stake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	stakingAddress: TAddress,
	amount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsContract = new ethers.Contract(stakingAddress, STAKING_REWARDS_ABI, signer);
	return handleTx(stakingRewardsContract.stake(amount));
}

export async function unstake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	stakingAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsContract = new ethers.Contract(stakingAddress, STAKING_REWARDS_ABI, signer);
	return handleTx(stakingRewardsContract.exit());
}

export async function claim(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	stakingAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsContract = new ethers.Contract(stakingAddress, STAKING_REWARDS_ABI, signer);
	return handleTx(stakingRewardsContract.getReward());
}

export async function depositAndStake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	vaultAddress: TAddress,
	amount: BigNumber
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const stakingRewardsZapContract = new ethers.Contract(STAKING_REWARDS_ZAP_ADDRESS, STAKING_REWARDS_ZAP_ABI, signer);
	return handleTx(stakingRewardsZapContract.zapIn(vaultAddress, amount));
}
