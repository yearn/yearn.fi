import {getEthZapperContract} from '@vaults/utils';
import VAULT_MIGRATOR_ABI from '@vaults/utils/abi/vaultMigrator.abi';
import ZAP_OPT_ETH_TO_YVETH_ABI from '@vaults/utils/abi/zapOptEthToYvEth';
import {erc20ABI, readContract} from '@wagmi/core';
import PARTNER_VAULT_ABI from '@yearn-finance/web-lib/utils/abi/partner.vault.abi';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import ZAP_ETH_TO_YVETH_ABI from '@yearn-finance/web-lib/utils/abi/zapEthToYvEth.abi';
import ZAP_FTM_TO_YVFTM_ABI from '@yearn-finance/web-lib/utils/abi/zapFtmToYvFTM.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import {assert} from '@common/utils/assert';
import {assertAddress, handleTx, toWagmiProvider} from '@common/utils/toWagmiProvider';

import type {Connector} from 'wagmi';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';
import type {TWriteTransaction} from '@common/utils/toWagmiProvider';

//Because USDT do not return a boolean on approve, we need to use this ABI
const ALTERNATE_ERC20_APPROVE_ABI = [{'constant': false, 'inputs': [{'name': '_spender', 'type': 'address'}, {'name': '_value', 'type': 'uint256'}], 'name': 'approve', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}] as const;

/* 🔵 - Yearn Finance **********************************************************
** isApprovedERC20 is a _VIEW_ function that checks if a token is approved for
** a spender.
******************************************************************************/
export async function isApprovedERC20(
	connector: Connector | undefined,
	tokenAddress: TAddress,
	spender: TAddress,
	amount = MAX_UINT_256
): Promise<boolean> {
	const wagmiProvider = await toWagmiProvider(connector);
	const result = await readContract({
		...wagmiProvider,
		abi: erc20ABI,
		address: tokenAddress,
		functionName: 'allowance',
		args: [wagmiProvider.address, spender]
	});
	return (result || 0n) >= amount;
}

/* 🔵 - Yearn Finance **********************************************************
** allowanceOf is a _VIEW_ function that returns the amount of a token that is
** approved for a spender.
******************************************************************************/
type TAllowanceOf = {
	connector: Connector | undefined,
	tokenAddress: TAddress,
	spenderAddress: TAddress
}
export async function allowanceOf(props: TAllowanceOf): Promise<bigint> {
	const wagmiProvider = await toWagmiProvider(props.connector);
	const result = await readContract({
		...wagmiProvider,
		abi: erc20ABI,
		address: props.tokenAddress,
		functionName: 'allowance',
		args: [wagmiProvider.address, props.spenderAddress]
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
	spenderAddress: TAddress | undefined;
	amount: bigint;
};
export async function approveERC20(props: TApproveERC20): Promise<TTxResponse> {
	assertAddress(props.spenderAddress, 'spenderAddress');
	assertAddress(props.contractAddress);

	props.onTrySomethingElse = async (): Promise<TTxResponse> => {
		assertAddress(props.spenderAddress, 'spenderAddress');
		return await handleTx(props, {
			address: props.contractAddress,
			abi: ALTERNATE_ERC20_APPROVE_ABI,
			functionName: 'approve',
			args: [props.spenderAddress, props.amount]
		});
	};

	return await handleTx(props, {
		address: props.contractAddress,
		abi: erc20ABI,
		functionName: 'approve',
		args: [props.spenderAddress, props.amount]
	});
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
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VAULT_ABI,
		functionName: 'deposit',
		args: [props.amount]
	});
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
export async function depositETH(props: TDepositEth): Promise<TTxResponse> {
	assert(props.connector, 'No connector');
	assert(props.amount > 0n, 'Amount is 0');
	const chainID = await props.connector.getChainId();
	switch (chainID) {
		case 1: {
			return await handleTx(props, {
				address: getEthZapperContract(1),
				abi: ZAP_ETH_TO_YVETH_ABI,
				functionName: 'deposit',
				value: props.amount
			});
		}
		case 10: {
			return await handleTx(props, {
				address: getEthZapperContract(10),
				abi: ZAP_OPT_ETH_TO_YVETH_ABI,
				functionName: 'deposit',
				value: props.amount
			});
		}
		case 250: {
			return await handleTx(props, {
				address: getEthZapperContract(250),
				abi: ZAP_FTM_TO_YVFTM_ABI,
				functionName: 'deposit',
				value: props.amount
			});
		}
		case 1337: {
			return await handleTx(props, {
				address: getEthZapperContract(1),
				abi: ZAP_ETH_TO_YVETH_ABI,
				functionName: 'deposit',
				value: props.amount
			});
		}
		default: {
			throw new Error('Invalid chainId');
		}
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
	vaultAddress: TAddress | undefined;
	partnerAddress: TAddress | undefined;
	amount: bigint;
};
export async function depositViaPartner(props: TDepositViaPartner): Promise<TTxResponse> {
	assertAddress(props.vaultAddress, 'vaultAddress');
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: PARTNER_VAULT_ABI,
		functionName: 'deposit',
		args: [
			props.vaultAddress,
			props.partnerAddress || toAddress(process.env.PARTNER_ID_ADDRESS),
			props.amount
		]
	});
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
	assert(props.connector, 'No connector');
	assert(props.amount > 0n, 'Amount is 0');
	const chainID = await props.connector.getChainId();
	switch (chainID) {
		case 1: {
			return await handleTx(props, {
				address: getEthZapperContract(1),
				abi: ZAP_ETH_TO_YVETH_ABI,
				functionName: 'withdraw',
				args: [props.amount]
			});
		}
		case 10: {
			return await handleTx(props, {
				address: getEthZapperContract(10),
				abi: ZAP_OPT_ETH_TO_YVETH_ABI,
				functionName: 'withdraw',
				args: [props.amount]
			});
		}
		case 250: {
			return await handleTx(props, {
				address: getEthZapperContract(250),
				abi: ZAP_FTM_TO_YVFTM_ABI,
				functionName: 'withdraw',
				args: [props.amount]
			});
		}
		case 1337: {
			return await handleTx(props, {
				address: getEthZapperContract(1),
				abi: ZAP_ETH_TO_YVETH_ABI,
				functionName: 'withdraw',
				args: [props.amount]
			});
		}
		default: {
			throw new Error('Invalid chainId');
		}
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
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VAULT_ABI,
		functionName: 'withdraw',
		args: [props.amount]
	});
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
	fromVault: TAddress | undefined;
	toVault: TAddress | undefined;
};
export async function migrateShares(props: TMigrateShares): Promise<TTxResponse> {
	assertAddress(props.fromVault, 'fromVault');
	assertAddress(props.toVault, 'toVault');
	assertAddress(props.contractAddress);

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VAULT_MIGRATOR_ABI,
		functionName: 'migrateAll',
		args: [props.fromVault, props.toVault]
	});
}
