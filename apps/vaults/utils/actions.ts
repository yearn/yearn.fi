import {captureException} from '@sentry/nextjs';
import STAKING_REWARDS_ABI from '@vaults/utils/abi/stakingRewards.abi';
import STAKING_REWARDS_ZAP_ABI from '@vaults/utils/abi/stakingRewardsZap.abi';
import ZAP_VE_CRV_ABI from '@vaults/utils/abi/zapVeCRV.abi';
import {prepareWriteContract, waitForTransaction, writeContract} from '@wagmi/core';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {STAKING_REWARDS_ZAP_ADDRESS, VAULT_FACTORY_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';

import VAULT_FACTORY_ABI from './abi/vaultFactory.abi';

import type {BaseError} from 'viem';
import type {TAddressWagmi} from '@yearn-finance/web-lib/types';
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
	vaultAddress: TAddressWagmi;
	amount: bigint;
};
export async function depositAndStake(props: TDepositAndStake): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.vaultAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(STAKING_REWARDS_ZAP_ADDRESS),
			abi: STAKING_REWARDS_ZAP_ABI,
			functionName: 'zapIn',
			args: [props.vaultAddress, props.amount]
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}

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
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: STAKING_REWARDS_ABI,
			functionName: 'stake',
			args: [props.amount]
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
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

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: STAKING_REWARDS_ABI,
			functionName: 'exit'
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
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

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: props.contractAddress,
			abi: STAKING_REWARDS_ABI,
			functionName: 'getReward'
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
}

/* 🔵 - Yearn Finance **********************************************************
** stake is a _WRITE_ function that unstake the shares of the vault from the
** staking contract.
**
** @app - Vaults (veCRV)
** @param inputToken - The token to be send to the zap
** @param outputToken - The token to receive from the zap
** @param amount - The amount of inputToken to be sent to the zap
******************************************************************************/
type TVeCRVZap = TWriteTransaction & {
	inputToken: TAddressWagmi;
	outputToken: TAddressWagmi;
	amount: bigint;
};
export async function veCRVzap(props: TVeCRVZap): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.inputToken);
	assertAddress(props.outputToken);
	assert(props.amount > 0n, 'Amount must be greater than 0n');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(ZAP_YEARN_VE_CRV_ADDRESS),
			abi: ZAP_VE_CRV_ABI,
			functionName: 'zap',
			args: [props.inputToken, props.outputToken, props.amount]
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
}


/* 🔵 - Yearn Finance **********************************************************
** createNewVaultsAndStrategies is a _WRITE_ function that creates a new vault
** and strategy for the given gauge.
**
** @app - Vaults (veCRV)
** @param gaugeAddress - the base gauge address
******************************************************************************/
// overwrite contractAddress type to force it to VAULT_FACTORY_ADDRESS
type TCreateNewVaultsAndStrategies = TWriteTransaction & {
	gaugeAddress: TAddressWagmi;
};
export async function createNewVaultsAndStrategies(props: TCreateNewVaultsAndStrategies): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.gaugeAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(VAULT_FACTORY_ADDRESS),
			abi: VAULT_FACTORY_ABI,
			functionName: 'createNewVaultsAndStrategies',
			args: [props.gaugeAddress]
		});
		const {hash} = await writeContract(config.request);
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash});
		if (receipt.status === 'success') {
			props.statusHandler?.({...defaultTxStatus, success: true});
		} else if (receipt.status === 'reverted') {
			props.statusHandler?.({...defaultTxStatus, error: true});
		}
		return ({isSuccessful: receipt.status === 'success', receipt});
	} catch (error) {
		console.error(error);
		const errorAsBaseError = error as BaseError;
		captureException(errorAsBaseError);
		props.statusHandler?.({...defaultTxStatus, error: true});
		return ({isSuccessful: false, error: errorAsBaseError || ''});
	} finally {
		setTimeout((): void => {
			props.statusHandler?.({...defaultTxStatus});
		}, 3000);
	}
}

/* 🔵 - Yearn Finance **********************************************************
** gasOfCreateNewVaultsAndStrategies is a _READ function that estimate the gas
** of the createNewVaultsAndStrategies function.
**
** @app - Vaults (veCRV)
** @param gaugeAddress - the base gauge address
******************************************************************************/
export async function gasOfCreateNewVaultsAndStrategies(props: TCreateNewVaultsAndStrategies): Promise<bigint> {
	assertAddress(props.contractAddress);
	assertAddress(props.gaugeAddress);

	const wagmiProvider = await toWagmiProvider(props.connector);
	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(VAULT_FACTORY_ADDRESS),
			abi: VAULT_FACTORY_ABI,
			functionName: 'createNewVaultsAndStrategies',
			args: [props.gaugeAddress]
		});
		return toBigInt(config.request.gas);
	} catch (error) {
		console.error(error);
		return toBigInt(0);
	}
}
