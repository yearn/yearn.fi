import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';

import VEYFI_CLAIM_REWARDS_ZAP_ABI from '../abi/veYFIClaimRewardsZap.abi';
import VEYFI_GAUGE_ABI from '../abi/veYFIGauge.abi';
import {VEYFI_CLAIM_REWARDS_ZAP_ADDRESS} from '../constants';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export async function approveStake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	vaultAddress: TAddress,
	gaugeAddress: TAddress,
	amount?: bigint
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const contract = new ethers.Contract(vaultAddress, ['function approve(address _spender, uint256 _value) external'], signer);
	return await handleTx(contract.approve(gaugeAddress, amount));
}

export async function approveAndStake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	vaultAddress: TAddress,
	gaugeAddress: TAddress,
	amount: bigint,
	allowance: bigint
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	if(!allowance.gte(amount)) {
		const contract = new ethers.Contract(vaultAddress, ['function approve(address _spender, uint256 _value) external'], signer);
		await contract.approve(gaugeAddress, amount);
	}
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.deposit(amount));
}

export async function stake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddress: TAddress,
	amount: bigint
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.deposit(amount));
}

export async function unstake(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddress: TAddress,
	amount: bigint
): Promise<TTxResponse> {
	const willClaim = false;
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.withdraw(amount, accountAddress, accountAddress, willClaim));
}

export async function claimRewards(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddress: TAddress
): Promise<TTxResponse> {
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(gaugeAddress, VEYFI_GAUGE_ABI, signer);
	return handleTx(gaugeContract.getReward());
}

export async function claimAllRewards(
	provider: ethers.providers.Web3Provider,
	accountAddress: TAddress,
	gaugeAddresses: TAddress[],
	claimVotingEscrow: boolean
): Promise<TTxResponse> {
	const willLockRewards = false;
	const signer = provider.getSigner(accountAddress);
	const gaugeContract = new ethers.Contract(VEYFI_CLAIM_REWARDS_ZAP_ADDRESS, VEYFI_CLAIM_REWARDS_ZAP_ABI, signer);
	return handleTx(gaugeContract.claim(
		gaugeAddresses,
		willLockRewards,
		claimVotingEscrow ?? false
	));
}
