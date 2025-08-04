import type {TCTA} from '@lib/components/yToast';
import type {TAddress} from '@lib/types';
import {assert, assertAddress, MAX_UINT_256, toAddress} from '@lib/utils';
import {PARTNER_VAULT_ABI} from '@lib/utils/abi/partner.vault.abi';
import {VAULT_ABI} from '@lib/utils/abi/vault.abi';
import {ZAP_ETH_TO_YVETH_ABI} from '@lib/utils/abi/zapEthToYvEth.abi';
import {ZAP_FTM_TO_YVFTM_ABI} from '@lib/utils/abi/zapFtmToYvFTM.abi';
import type {TTxResponse, TWriteTransaction} from '@lib/utils/wagmi';
import {handleTx, retrieveConfig, toWagmiProvider} from '@lib/utils/wagmi';
import {getEthZapperContract} from '@vaults-v2/utils';
import {ERC_4626_ROUTER_ABI} from '@vaults-v2/utils/abi/erc4626Router.abi';
import {VAULT_MIGRATOR_ABI} from '@vaults-v2/utils/abi/vaultMigrator.abi';
import {VAULT_V3_ABI} from '@vaults-v2/utils/abi/vaultV3.abi';
import {ZAP_OPT_ETH_TO_YVETH_ABI} from '@vaults-v2/utils/abi/zapOptEthToYvEth';
import {erc20Abi} from 'viem';
import type {Connector} from 'wagmi';
import {readContract} from 'wagmi/actions';

interface WindowWithCustomEthereum extends Window {
	ethereum?: {
		useForknetForMainnet?: boolean;
	};
}

function getChainID(chainID: number): number {
	if (typeof window !== 'undefined' && (window as WindowWithCustomEthereum)?.ethereum?.useForknetForMainnet) {
		if (chainID === 1) {
			return 1337;
		}
	}
	return chainID;
}

//Because USDT do not return a boolean on approve, we need to use this ABI
const ALTERNATE_ERC20_APPROVE_ABI = [
	{
		constant: false,
		inputs: [
			{name: '_spender', type: 'address'},
			{name: '_value', type: 'uint256'}
		],
		name: 'approve',
		outputs: [],
		payable: false,
		stateMutability: 'nonpayable',
		type: 'function'
	}
] as const;

/*******************************************************************************
 ** isApprovedERC20 is a _VIEW_ function that checks if a token is approved for
 ** a spender.
 ******************************************************************************/
export async function isApprovedERC20(
	connector: Connector | undefined,
	chainID: number,
	tokenAddress: TAddress,
	spender: TAddress,
	amount = MAX_UINT_256
): Promise<boolean> {
	const wagmiProvider = await toWagmiProvider(connector as Connector);
	const result = await readContract(retrieveConfig(), {
		...wagmiProvider,
		abi: erc20Abi,
		chainId: getChainID(chainID),
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
	connector: Connector | undefined;
	chainID: number;
	tokenAddress: TAddress;
	spenderAddress: TAddress;
};
export async function allowanceOf(props: TAllowanceOf): Promise<bigint> {
	const wagmiProvider = await toWagmiProvider(props.connector);
	const result = await readContract(retrieveConfig(), {
		...wagmiProvider,
		chainId: getChainID(props.chainID),
		abi: erc20Abi,
		address: props.tokenAddress,
		functionName: 'allowance',
		args: [wagmiProvider.address, props.spenderAddress]
	});

	return result || 0n;
}

/*******************************************************************************
 ** approveERC20 is a _WRITE_ function that approves a token for a spender.
 **
 ** @param spenderAddress - The address of the spender.
 ** @param amount - The amount of collateral to deposit.
 ******************************************************************************/
type TApproveERC20 = TWriteTransaction & {
	spenderAddress: TAddress | undefined;
	amount: bigint;
	confirmation?: number;
	cta?: TCTA;
};
export async function approveERC20(props: TApproveERC20): Promise<TTxResponse> {
	assertAddress(props.spenderAddress, 'spenderAddress');
	assertAddress(props.contractAddress);

	props.onTrySomethingElse = async (): Promise<TTxResponse> => {
		const propsWithoutOnTrySomethingElse = {...props, onTrySomethingElse: undefined};
		assertAddress(props.spenderAddress, 'spenderAddress');
		return await handleTx(propsWithoutOnTrySomethingElse, {
			address: toAddress(props.contractAddress),
			abi: ALTERNATE_ERC20_APPROVE_ABI,
			confirmation: props.confirmation ?? (process.env.NODE_ENV === 'development' ? 1 : undefined),
			functionName: 'approve',
			args: [props.spenderAddress, props.amount]
		});
	};

	return await handleTx(props, {
		address: props.contractAddress,
		abi: erc20Abi,
		confirmation: props.confirmation ?? (process.env.NODE_ENV === 'development' ? 1 : undefined),
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
	confirmation?: number;
};
export async function deposit(props: TDeposit): Promise<TTxResponse> {
	assert(props.amount > 0n, 'Amount is 0');
	assertAddress(props.contractAddress);
	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'wagmiProvider.address');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VAULT_ABI,
		functionName: 'deposit',
		args: [props.amount, wagmiProvider.address],
		confirmation: props.confirmation ?? (process.env.NODE_ENV === 'development' ? 1 : undefined)
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
	switch (props.chainID) {
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
		args: [props.vaultAddress, props.partnerAddress || toAddress(process.env.PARTNER_ID_ADDRESS), props.amount]
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
	switch (props.chainID) {
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
 ** redeemV3Shares is a _WRITE_ function that withdraws a share of underlying
 ** collateral from a v3 vault.
 **
 ** @app - Vaults
 ** @param amount - The amount of ETH to withdraw.
 ******************************************************************************/
type TRedeemV3Shares = TWriteTransaction & {
	amount: bigint;
	maxLoss: bigint;
};
export async function redeemV3Shares(props: TRedeemV3Shares): Promise<TTxResponse> {
	assert(props.amount > 0n, 'Amount is 0');
	assert(props.maxLoss > 0n && props.maxLoss <= 10000n, 'Max loss is invalid');
	assertAddress(props.contractAddress);
	const wagmiProvider = await toWagmiProvider(props.connector);
	assertAddress(wagmiProvider.address, 'wagmiProvider.address');

	return await handleTx(props, {
		address: props.contractAddress,
		abi: VAULT_V3_ABI,
		functionName: 'redeem',
		args: [props.amount, wagmiProvider.address, wagmiProvider.address, props.maxLoss]
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

type TMigrateSharesViaRouter = TWriteTransaction & {
	router: TAddress | undefined;
	fromVault: TAddress | undefined;
	toVault: TAddress | undefined;
	amount: bigint;
	maxLoss: bigint;
};
export async function migrateSharesViaRouter(props: TMigrateSharesViaRouter): Promise<TTxResponse> {
	assertAddress(props.router, 'router');
	assertAddress(props.fromVault, 'fromVault');
	assertAddress(props.toVault, 'toVault');
	assertAddress(props.contractAddress);
	assert(props.amount > 0n, 'Amount is 0');
	assert(props.maxLoss > 0n && props.maxLoss <= 10000n, 'Max loss is invalid');
	const minAmount = props.amount - (props.amount * props.maxLoss) / 10000n;

	return await handleTx(props, {
		address: props.router,
		abi: ERC_4626_ROUTER_ABI,
		functionName: 'migrate',
		args: [props.fromVault, props.toVault, props.amount, minAmount]
	});
}
