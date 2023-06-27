import {ethers} from 'ethers';
import {handleTx} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, assertAddresses, handleTx as handleTxWagmi} from '@common/utils/toWagmiProvider';

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

type TApproveAndStake = TWriteTransaction & {
	vaultAddress: TAddress;
	allowance: bigint;
	amount: bigint;
};
export async function approveAndStake(props: TApproveAndStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.vaultAddress);
	assert(props.amount > 0n, 'Amount is 0');

	if(!(props.allowance >= props.amount)) {
		await handleTxWagmi(props, {
			address: props.vaultAddress,
			abi: ['function approve(address _spender, uint256 _value) external'],
			functionName: 'approve',
			args: [props.contractAddress, props.amount]
		});
	}

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'deposit',
		args: [props.amount]
	});
}

type TStake = TWriteTransaction & {
	amount: bigint;
};
export async function stake(props: TStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'deposit',
		args: [props.amount]
	});
}

type TUnstake = TWriteTransaction & {
	accountAddress: TAddress;
	amount: bigint;
};
export async function unstake(props: TUnstake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	const willClaim = false;

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'withdraw',
		args: [props.amount, props.accountAddress, props.accountAddress, willClaim]
	});
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
	assertAddresses(props.gaugeAddresses);

	return await handleTxWagmi(props, {
		address: props.contractAddress,
		abi: VEYFI_CLAIM_REWARDS_ZAP_ABI,
		functionName: 'claim',
		args: [props.gaugeAddresses, props.willLockRewards, props.claimVotingEscrow]
	});
}
