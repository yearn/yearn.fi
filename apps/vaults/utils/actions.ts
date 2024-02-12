import {assert, assertAddress} from '@builtbymom/web3/utils';
import {handleTx} from '@builtbymom/web3/utils/wagmi';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {STAKING_REWARDS_ZAP_ABI} from '@vaults/utils/abi/stakingRewardsZap.abi';
import {STAKING_REWARDS_ZAP_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import {ZAP_CRV_ABI} from './abi/zapCRV.abi';

import type {TAddress} from '@builtbymom/web3/types';
import type {TTxResponse, TWriteTransaction} from '@builtbymom/web3/utils/wagmi';

/* 🔵 - Yearn Finance **********************************************************
 ** depositAndStake is a _WRITE_ function that deposit the underlying asset into
 ** the vault and stake the resulting shares into the staking contract.
 **
 ** @app - Vaults (optimism)
 ** @param vaultAddress - The address of the vault to deposit into.
 ** @param amount - The amount of the underlying asset to deposit.
 ******************************************************************************/
type TDepositAndStake = TWriteTransaction & {
	vaultAddress: TAddress | undefined;
	amount: bigint;
};
export async function depositAndStake(props: TDepositAndStake): Promise<TTxResponse> {
	assertAddress(STAKING_REWARDS_ZAP_ADDRESS, 'STAKING_REWARDS_ZAP_ADDRESS');
	assertAddress(props.vaultAddress, 'vaultAddress');
	assert(props.amount > 0n, 'Amount is 0');

	return await handleTx(props, {
		address: STAKING_REWARDS_ZAP_ADDRESS,
		abi: STAKING_REWARDS_ZAP_ABI,
		functionName: 'zapIn',
		args: [props.vaultAddress, props.amount]
	});
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

	assertAddress(ZAP_YEARN_VE_CRV_ADDRESS, 'ZAP_YEARN_VE_CRV_ADDRESS');
	assertAddress(props.inputToken, 'inputToken');
	assertAddress(props.outputToken, 'outputToken');
	assert(props.amount > 0n, 'Amount must be greater than 0');
	assert(props.minAmount > 0n, 'Min amount must be greater than 0');

	return await handleTx(props, {
		address: ZAP_YEARN_VE_CRV_ADDRESS,
		abi: ZAP_CRV_ABI,
		functionName: 'zap',
		args: [props.inputToken, props.outputToken, props.amount, minAmountWithSlippage]
	});
}
