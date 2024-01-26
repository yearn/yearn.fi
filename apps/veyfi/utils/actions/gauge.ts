import {erc20ABI} from 'wagmi';
import {assert, assertAddress, toAddress} from '@builtbymom/web3/utils';
import {handleTx, toWagmiProvider} from '@builtbymom/web3/utils/wagmi';
import {VEYFI_CLAIM_REWARDS_ZAP_ABI} from '@veYFI/utils/abi/veYFIClaimRewardsZap.abi';
import {VEYFI_GAUGE_ABI} from '@veYFI/utils/abi/veYFIGauge.abi';
import {allowanceOf} from '@common/utils/actions';

import {YFI_REWARD_POOL_ABI} from '../abi/YFIRewardPool.abi';

import type {TAddress} from '@builtbymom/web3/types';
import type {TTxResponse, TWriteTransaction} from '@builtbymom/web3/utils/wagmi';

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

	if (allowance < props.amount) {
		try {
			await handleTx(props, {
				address: props.vaultAddress,
				abi: erc20ABI,
				functionName: 'approve',
				args: [props.contractAddress, props.amount]
			});
		} catch (error) {
			return {isSuccessful: false, error: error};
		}
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

type TClaimBoostRewards = TWriteTransaction;
export async function claimBoostRewards(props: TClaimBoostRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'ownerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: YFI_REWARD_POOL_ABI,
		functionName: 'claim',
		args: [wagmiProvider.address]
	});
}

type TClaimAllRewards = TWriteTransaction & {
	gaugeAddresses: TAddress[];
	willLockRewards: boolean;
	claimVotingEscrow?: boolean;
};
export async function claimAllRewards(props: TClaimAllRewards): Promise<TTxResponse> {
	assertAddress(props.contractAddress, 'contractAddress');
	for (const addr of props.gaugeAddresses) {
		assertAddress(addr);
	}

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_CLAIM_REWARDS_ZAP_ABI,
		functionName: 'claim',
		args: [props.gaugeAddresses, props.willLockRewards, props.claimVotingEscrow]
	});
}
