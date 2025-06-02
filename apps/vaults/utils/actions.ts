import {assert, assertAddress, toAddress} from '@lib/utils';
import {STAKING_REWARDS_ZAP_ADDRESS} from '@lib/utils/constants';
import {handleTx, toWagmiProvider} from '@lib/utils/wagmi';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {STAKING_REWARDS_ZAP_ABI} from '@vaults/utils/abi/stakingRewardsZap.abi';
import {YGAUGE_ZAP_ABI} from '@vaults-v3/utils/abi/yGaugeZap.abi';
import {V3_STAKING_ZAP_ADDRESS, YGAUGES_ZAP_ADDRESS} from '@common/utils/constants';

import {V3_REWARDS_ZAP_ABI} from './abi/V3RewardsZap.abi';
import {VEYFI_GAUGE_ABI} from './abi/veYFIGauge.abi';
import {ZAP_CRV_ABI} from './abi/zapCRV.abi';

import type {TAddress} from '@lib/types';
import type {TTxResponse, TWriteTransaction} from '@lib/utils/wagmi';

/* 🔵 - Yearn Finance **********************************************************
 ** depositAndStake is a _WRITE_ function that deposit the underlying asset into
 ** the vault and stake the resulting shares into the staking contract.
 **
 ** @app - Vaults
 ** @param vaultAddress - The address of the vault to deposit into.
 ** @param amount - The amount of the underlying asset to deposit.
 ** @param vaultVersion - The version of the vault to deposit into.
 ** @param stakingPoolAddress - The address of the staking pool to stake into.
 **		For VeYFI vaults only, ignored for Optimism.
 ******************************************************************************/
type TDepositAndStake = TWriteTransaction & {
	vaultAddress: TAddress | undefined;
	stakingPoolAddress?: TAddress | undefined;
	vaultVersion?: string | undefined;
	amount: bigint;
};
export async function depositAndStake(props: TDepositAndStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress, 'contractAddress');
	assertAddress(props.vaultAddress, 'vaultAddress');
	assert(props.amount > 0n, 'Amount is 0');

	// If we are depositing into the Optimism Booster
	if (props.chainID === 10 && toAddress(props.contractAddress) === toAddress(STAKING_REWARDS_ZAP_ADDRESS)) {
		return await handleTx(props, {
			address: props.contractAddress,
			abi: STAKING_REWARDS_ZAP_ABI,
			functionName: 'zapIn',
			args: [props.vaultAddress, props.amount]
		});
	}
	// If we are depositing into the V3 Staking
	if (
		V3_STAKING_ZAP_ADDRESS[props.chainID] &&
		toAddress(props.contractAddress) === toAddress(V3_STAKING_ZAP_ADDRESS[props.chainID])
	) {
		return await handleTx(props, {
			address: props.contractAddress,
			abi: V3_REWARDS_ZAP_ABI,
			functionName: 'zapIn',
			args: [props.vaultAddress, props.amount, false]
		});
	}

	// If we are depositing into the VeYFI gauge
	if (toAddress(props.contractAddress) === toAddress(YGAUGES_ZAP_ADDRESS)) {
		assertAddress(props.stakingPoolAddress, 'stakingPoolAddress');
		if ((props.vaultVersion || '').startsWith('3') || (props.vaultVersion || '').startsWith('~3')) {
			return await handleTx(props, {
				address: props.contractAddress,
				abi: YGAUGE_ZAP_ABI,
				functionName: 'zapIn',
				args: [props.vaultAddress, props.amount, props.stakingPoolAddress]
			});
		}

		return await handleTx(props, {
			address: props.contractAddress,
			abi: YGAUGE_ZAP_ABI,
			functionName: 'zapInLegacy',
			args: [props.vaultAddress, props.amount, props.stakingPoolAddress]
		});
	}
	throw new Error('Invalid contract address');
}

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that stake the shares of the vault into the
 ** staking contract.
 **
 ** @app - Vaults (optimism)
 ** @param amount - The amount of the underlying asset to deposit.
 ******************************************************************************/
type TStake = TWriteTransaction & {
	amount: bigint;
};
export async function stake(props: TStake): Promise<TTxResponse> {
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: STAKING_REWARDS_ABI,
		functionName: 'stake',
		args: [props.amount]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that stakes a given amount of the underlying
 ** asset into the veYFI gauge.
 **
 ** @app - veYFI
 ** @param amount - The amount of the underlying asset to deposit.
 ******************************************************************************/
export async function stakeVeYFIGauge(props: TStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'deposit',
		args: [props.amount]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that unstake the shares of the vault from the
 ** staking contract.
 **
 ** @app - Vaults (optimism)
 ******************************************************************************/
type TUnstake = TWriteTransaction;
export async function unstake(props: TUnstake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: STAKING_REWARDS_ABI,
		functionName: 'exit'
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** unstake is a _WRITE_ function that unstakes a given amount of the underlying
 ** asset.
 **
 ** @app - veYFI
 ******************************************************************************/
type TUnstakeVeYFIGauge = TWriteTransaction & {
	amount: bigint;
	willClaim: boolean;
};
export async function unstakeVeYFIGauge(props: TUnstakeVeYFIGauge): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'ownerAddress');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VEYFI_GAUGE_ABI,
		functionName: 'withdraw',
		args: [props.amount, wagmiProvider.address, wagmiProvider.address, props.willClaim]
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** stake is a _WRITE_ function that unstake the shares of the vault from the
 ** staking contract.
 **
 ** @app - Vaults (optimism)
 ******************************************************************************/
type TClaim = TWriteTransaction;
export async function claim(props: TClaim): Promise<TTxResponse> {
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: STAKING_REWARDS_ABI,
		functionName: 'getReward'
	});
}

/* 🔵 - Yearn Finance **********************************************************
 ** zapCRV is a _WRITE_ function that can be used to zap some supported tokens
 ** from the Curve ecosystem into one of the Yearn's yCRV ecosystem.
 **
 ** @app - yCRV
 ** @param inputToken - Token to be zapped from curve
 ** @param outputToken - Token to be zapped into Yearn's yCRV ecosystem
 ** @param amount - Amount of inputToken to be zapped
 ** @param minAmount - Minimum amount of outputToken to be received
 ** @param slippage - Slippage tolerance
 ******************************************************************************/
type TZapYCRV = TWriteTransaction & {
	inputToken: TAddress | undefined;
	outputToken: TAddress | undefined;
	amount: bigint;
	minAmount: bigint;
	slippage: bigint;
};
export async function zapCRV(props: TZapYCRV): Promise<TTxResponse> {
	const minAmountWithSlippage = props.minAmount - (props.minAmount * props.slippage) / 10_000n;

	assertAddress(props.contractAddress, 'props.contractAddress');
	assertAddress(props.inputToken, 'inputToken');
	assertAddress(props.outputToken, 'outputToken');
	assert(props.amount > 0n, 'Amount must be greater than 0');
	assert(props.minAmount > 0n, 'Min amount must be greater than 0');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: ZAP_CRV_ABI,
		functionName: 'zap',
		args: [props.inputToken, props.outputToken, props.amount, minAmountWithSlippage]
	});
}
