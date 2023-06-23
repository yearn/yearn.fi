import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assertAddress, handleTx as handleTxWagmi} from '@common/utils/toWagmiProvider';

import VEYFI_CLAIM_REWARDS_ZAP_ABI from '../abi/veYFIClaimRewardsZap.abi';
import VEYFI_GAUGE_ABI from '../abi/veYFIGauge.abi';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

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
	if(!(allowance >= amount)) {
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

type TClaimRewards = TWriteTransaction;
export async function claimRewards(props: TClaimRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'getReward'
	});
}

type TClaimAllRewards = TWriteTransaction & {
	gaugeAddresses: TAddress[];
	willLockRewards: boolean;
	claimVotingEscrow?: boolean;
};
export async function claimAllRewards(props: TClaimAllRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_CLAIM_REWARDS_ZAP_ABI,
		functionName: 'claim',
		args: [props.gaugeAddresses, props.willLockRewards, props.claimVotingEscrow]
	});
}
