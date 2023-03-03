import {ethers} from 'ethers';
import {approveERC20} from '@common/utils/actions/approveToken';

import VEYFI_CLAIM_REWARDS_ZAP_ABI from '../abi/veYFIClaimRewardsZap.abi';
import VEYFI_GAUGE_ABI from '../abi/veYFIGauge.abi';
import {VEYFI_CLAIM_REWARDS_ZAP_ADDRESS} from '../constants';
import {handleTx} from '..';

import type {BigNumber} from 'ethers';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';

export async function approveStake(
	provider: ethers.providers.Web3Provider,
	_accountAddress: TAddress,
	vaultAddress: TAddress,
	gaugeAddress: TAddress,
	amount?: BigNumber
): Promise<boolean> {
	return approveERC20(provider, vaultAddress, gaugeAddress, amount);
}

export async function approveAndStake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	vaultAddress: TAddress,
	gaugeAddress: TAddress,
	amount: BigNumber,
	allowance: BigNumber
): Promise<boolean> {
	let isApproved = allowance.gte(amount);
	if(!isApproved) {
		isApproved = await approveERC20(provider, vaultAddress, gaugeAddress, amount);
	}
	if(!isApproved) {
		return false;
	}
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.deposit(amount));
}

export async function stake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddress: TAddress,
	amount: BigNumber
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.deposit(amount));
}

export async function unstake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddress: TAddress,
	amount: BigNumber
): Promise<boolean> {
	const willClaim = false;
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.withdraw(amount, accountAddress, accountAddress, willClaim));
}

export async function claimRewards(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddress: TAddress
): Promise<boolean> {
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.getReward());
}

export async function claimAllRewards(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddresses: TAddress[],
	claimVotingEscrow: boolean
): Promise<boolean> {
	const willLockRewards = false;
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(VEYFI_CLAIM_REWARDS_ZAP_ADDRESS, VEYFI_CLAIM_REWARDS_ZAP_ABI, signer);
	return handleTx(gaugeContract.claim(
		gaugeAddresses,
		willLockRewards,
		claimVotingEscrow ?? false
	));
}
