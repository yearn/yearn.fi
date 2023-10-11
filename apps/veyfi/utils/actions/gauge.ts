import {VEYFI_CLAIM_REWARDS_ZAP_ABI} from '@veYFI/utils/abi/veYFIClaimRewardsZap.abi';
import {VEYFI_GAUGE_ABI} from '@veYFI/utils/abi/veYFIGauge.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {handleTx, type TWriteTransaction} from '@yearn-finance/web-lib/utils/wagmi/provider';
import {assertAddress} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {allowanceOf} from '@common/utils/actions';
import {assert} from '@common/utils/assert';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

type TApproveAndStake = TWriteTransaction & {
	vaultAddress: TAddress;
	amount: bigint;
};
export async function approveAndStake(props: TApproveAndStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.vaultAddress);
	assert(props.amount > 0n, 'Amount is 0');

	const allowance = await allowanceOf({
		connector: props.connector,
		chainID: props.chainID,
		tokenAddress: props.vaultAddress,
		spenderAddress: toAddress(props.contractAddress)
	});

	if (!(allowance >= props.amount)) {
		await handleTx(props, {
			address: props.vaultAddress,
			abi: ['function approve(address _spender, uint256 _value) external'],
			functionName: 'approve',
			args: [props.contractAddress, props.amount]
		});
	}

	return await handleTx(props, {
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

	return await handleTx(props, {
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
	assertAddress(props.accountAddress);
	assert(props.amount > 0n, 'Amount is 0');

	const willClaim = false;

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'withdraw',
		args: [props.amount, props.accountAddress, props.accountAddress, willClaim]
	});
}

type TClaimRewards = TWriteTransaction;
export async function claimRewards(props: TClaimRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	return await handleTx(props, {
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
	for (const gaugeAddress of props.gaugeAddresses) {
		assertAddress(gaugeAddress);
	}

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_CLAIM_REWARDS_ZAP_ABI,
		functionName: 'claim',
		args: [props.gaugeAddresses, props.willLockRewards, props.claimVotingEscrow]
	});
}
