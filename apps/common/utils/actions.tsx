import {captureException} from '@sentry/nextjs';
import {getEthZapperContract} from '@vaults/utils';
import VAULT_MIGRATOR_ABI from '@vaults/utils/abi/vaultMigrator.abi';
import {erc20ABI, prepareWriteContract, readContract, waitForTransaction, writeContract} from '@wagmi/core';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import PARTNER_VAULT_ABI from '@yearn-finance/web-lib/utils/abi/partner.vault.abi';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import ZAP_ETH_TO_YVETH_ABI from '@yearn-finance/web-lib/utils/abi/zapEthToYvEth.abi';
import ZAP_FTM_TO_YVFTM_ABI from '@yearn-finance/web-lib/utils/abi/zapFtmToYvFTM.abi';
import {toWagmiAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {assert} from '@common/utils/assert';
import {assertAddress, toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {BaseError, Hex} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress, TAddressWagmi} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

/* 🔵 - Yearn Finance **********************************************************
** isApprovedERC20 is a _VIEW_ function that checks if a token is approved for
** a spender.
******************************************************************************/
export async function	isApprovedERC20(
	connector: Connector,
	tokenAddress: TAddress,
	spender: TAddress,
	amount = MAX_UINT_256
): Promise<boolean> {
	const wagmiProvider = await toWagmiProvider(connector);
	const result = await readContract({
		...wagmiProvider,
		abi: erc20ABI,
		address: toWagmiAddress(tokenAddress),
		functionName: 'allowance',
		args: [toWagmiAddress(wagmiProvider.address), toWagmiAddress(spender)]
	});
	return (result || 0n) >= amount;
}

/* 🔵 - Yearn Finance **********************************************************
** approvedERC20Amount is a _VIEW_ function that returns the amount of a token
** that is approved for a spender.
******************************************************************************/
export async function	approvedERC20Amount(
	connector: Connector,
	tokenAddress: TAddress,
	spender: TAddress
): Promise<bigint> {
	const wagmiProvider = await toWagmiProvider(connector);
	const result = await readContract({
		...wagmiProvider,
		abi: erc20ABI,
		address: toWagmiAddress(tokenAddress),
		functionName: 'allowance',
		args: [toWagmiAddress(wagmiProvider.address), toWagmiAddress(spender)]
	});
	return result || 0n;
}

/* 🔵 - Yearn Finance **********************************************************
** approveERC20 is a _WRITE_ function that approves a token for a spender.
**
** @param spenderAddress - The address of the spender.
** @param amount - The amount of collateral to deposit.
******************************************************************************/
type TApproveERC20 = TWriteTransaction & {
	spenderAddress: TAddressWagmi;
	amount: bigint;
};
export async function	approveERC20(props: TApproveERC20): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.spenderAddress);

	props.statusHandler?.({...defaultTxStatus, pending: true});
	try {
		const wagmiProvider = await toWagmiProvider(props.connector);
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(props.contractAddress),
			abi: erc20ABI,
			functionName: 'approve',
			args: [toWagmiAddress(props.spenderAddress), props.amount]
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
** deposit is a _WRITE_ function that deposits a collateral into a vault using
** the vanilla direct deposit function.
**
** @app - Vaults
** @param amount - The amount of ETH to deposit.
******************************************************************************/
type TDeposit = TWriteTransaction & {
	amount: bigint;
};
export async function deposit(props: TDeposit): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(props.contractAddress),
			abi: VAULT_ABI,
			functionName: 'deposit',
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
** depositETH is a _WRITE_ function that deposits ETH into a vault accepting
** wETH as collateral. Based on the chainId, it will use the appropriate
** contract.
**
** @app - Vaults
** @param amount - The amount of collateral to deposit.
******************************************************************************/
type TDepositEth = TWriteTransaction & {
	amount: bigint;
};
export async function	depositETH(props: TDepositEth): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(props.connector);
	const destAddress = toWagmiAddress(getEthZapperContract(wagmiProvider.chainId));
	assertAddress(props.contractAddress);
	assertAddress(destAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	try {
		let txHash: Hex;
		if (wagmiProvider.chainId === 250) {
			const config = await prepareWriteContract({
				...wagmiProvider,
				address: destAddress,
				abi: ZAP_FTM_TO_YVFTM_ABI,
				functionName: 'deposit',
				value: props.amount
			});
			const {hash} = await writeContract(config.request);
			txHash = hash;
		} else {
			const config = await prepareWriteContract({
				...wagmiProvider,
				address: destAddress,
				abi: ZAP_ETH_TO_YVETH_ABI,
				functionName: 'deposit',
				value: props.amount
			});
			const {hash} = await writeContract(config.request);
			txHash = hash;
		}
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash: txHash});
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
** depositViaPartner is a _WRITE_ function that deposits a collateral into a
** vault using a partner contract. This is used to keep track of the delegated
** amount.
**
** @app - Vaults
** @param amount - The amount of ETH to deposit.
******************************************************************************/
type TDepositViaPartner = TWriteTransaction & {
	vaultAddress: TAddressWagmi;
	partnerAddress: TAddressWagmi | undefined;
	amount: bigint;
};
export async function depositViaPartner(props: TDepositViaPartner): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.vaultAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);

	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(props.contractAddress),
			abi: PARTNER_VAULT_ABI,
			functionName: 'deposit',
			args: [
				props.vaultAddress,
				props.partnerAddress || toWagmiAddress(process.env.PARTNER_ID_ADDRESS),
				props.amount
			]
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
** withdrawETH is a _WRITE_ function that withdraws ETH from a vault accepting
** wETH as collateral. Based on the chainId, it will use the appropriate
** contract.
**
** @app - Vaults
** @param amount - The amount of ETH to withdraw.
******************************************************************************/
type TWithdrawEth = TWriteTransaction & {
	amount: bigint;
};
export async function withdrawETH(props: TWithdrawEth): Promise<TTxResponse> {
	const wagmiProvider = await toWagmiProvider(props.connector);
	const destAddress = toWagmiAddress(getEthZapperContract(wagmiProvider.chainId));
	assertAddress(props.contractAddress);
	assertAddress(destAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	try {
		let txHash: Hex;
		if (wagmiProvider.chainId === 250) {
			const config = await prepareWriteContract({
				...wagmiProvider,
				address: destAddress,
				abi: ZAP_FTM_TO_YVFTM_ABI,
				functionName: 'withdraw',
				args: [props.amount]
			});
			const {hash} = await writeContract(config.request);
			txHash = hash;
		} else {
			const config = await prepareWriteContract({
				...wagmiProvider,
				address: destAddress,
				abi: ZAP_ETH_TO_YVETH_ABI,
				functionName: 'withdraw',
				args: [props.amount]
			});
			const {hash} = await writeContract(config.request);
			txHash = hash;
		}
		const receipt = await waitForTransaction({chainId: wagmiProvider.chainId, hash: txHash});
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
** withdrawShares is a _WRITE_ function that withdraws a share of underlying
** collateral from a vault.
**
** @app - Vaults
** @param amount - The amount of ETH to withdraw.
******************************************************************************/
type TWithdrawShares = TWriteTransaction & {
	amount: bigint;
};
export async function withdrawShares(props: TWithdrawShares): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');

	props.statusHandler?.({...defaultTxStatus, pending: true});
	const wagmiProvider = await toWagmiProvider(props.connector);
	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(props.contractAddress),
			abi: VAULT_ABI,
			functionName: 'withdraw',
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
** migrateShares is a _WRITE_ function that migrates the tokens from one vault
** to another. This is used to migrate from deprecated vaults to new ones.
**
** @app - Vaults
** @param fromVault - The address of the vault to migrate from.
** @param toVault - The address of the vault to migrate to.
******************************************************************************/
type TMigrateShares = TWriteTransaction & {
	fromVault: TAddressWagmi;
	toVault: TAddressWagmi;
};
export async function	migrateShares(props: TMigrateShares): Promise<TTxResponse> {
	assertAddress(props.contractAddress);
	assertAddress(props.fromVault);
	assertAddress(props.toVault);

	const {toast} = yToast();
	const wagmiProvider = await toWagmiProvider(props.connector);
	try {
		const config = await prepareWriteContract({
			...wagmiProvider,
			address: toWagmiAddress(props.contractAddress),
			abi: VAULT_MIGRATOR_ABI,
			functionName: 'migrateAll',
			args: [props.fromVault, props.toVault]
		});

		const gas = config?.request?.gas || 0n;
		const estimateGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(gas);
		const safeGas = new Intl.NumberFormat([navigator.language || 'fr-FR', 'en-US']).format(gas * 13n / 10n);
		toast({
			type: 'info',
			content: `Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`,
			duration: 10000
		});
		console.info(`Gas estimate for migration is ${estimateGas}. We'll use ${safeGas} to give some margin and reduce the risk of transaction failure.`);
		config.request.gas = gas * 13n / 10n;

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
