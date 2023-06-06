import STAKING_REWARDS_ABI from '@vaults/utils/abi/stakingRewards.abi';
import STAKING_REWARDS_ZAP_ABI from '@vaults/utils/abi/stakingRewardsZap.abi';
import VAULT_FACTORY_ABI from '@vaults/utils/abi/vaultFactory.abi';
import {getPublicClient} from '@wagmi/core';
import {} from '@yearn-finance/web-lib/utils/address';
import {STAKING_REWARDS_ZAP_ADDRESS, VAULT_FACTORY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx, toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

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
** createNewVaultsAndStrategies is a _WRITE_ function that creates a new vault
** and strategy for the given gauge.
**
** @app - Vaults (veCRV)
** @param gaugeAddress - the base gauge address
******************************************************************************/
type TCreateNewVaultsAndStrategies = TWriteTransaction & {
	gaugeAddress: TAddress | undefined;
};
export async function createNewVaultsAndStrategies(props: TCreateNewVaultsAndStrategies): Promise<TTxResponse> {
	assertAddress(VAULT_FACTORY_ADDRESS, 'VAULT_FACTORY_ADDRESS');
	assertAddress(props.gaugeAddress, 'gaugeAddress');

	return await handleTx(props, {
		address: VAULT_FACTORY_ADDRESS,
		abi: VAULT_FACTORY_ABI,
		functionName: 'createNewVaultsAndStrategies',
		args: [props.gaugeAddress]
	});
}

/* 🔵 - Yearn Finance **********************************************************
** gasOfCreateNewVaultsAndStrategies is a _READ_ function that estimate the gas
** of the createNewVaultsAndStrategies function.
**
** @app - Vaults (veCRV)
** @param gaugeAddress - the base gauge address
******************************************************************************/
export async function gasOfCreateNewVaultsAndStrategies(props: TCreateNewVaultsAndStrategies): Promise<bigint> {
	try {
		assertAddress(props.contractAddress, 'contractAddress');
		assertAddress(props.gaugeAddress, 'gaugeAddress');

		const wagmiProvider = await toWagmiProvider(props.connector);
		const client = await getPublicClient({chainId: wagmiProvider.chainId});
		const gas = await client.estimateContractGas({
			address: VAULT_FACTORY_ADDRESS,
			abi: VAULT_FACTORY_ABI,
			functionName: 'createNewVaultsAndStrategies',
			args: [props.gaugeAddress],
			account: wagmiProvider.address
		});
		return toBigInt(gas);
	} catch (error) {
		console.error(error);
		return toBigInt(0);
	}
}
