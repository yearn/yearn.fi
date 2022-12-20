import React, {useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {getEthZapperContract} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import {approveERC20} from '@common/utils/actions/approveToken';
import {depositETH} from '@common/utils/actions/depositEth';
import {withdrawETH} from '@common/utils/actions/withdrawEth';

import type {ReactElement} from 'react';
import type {TAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

export type TSolver = {
	isDepositing: boolean,
	amount: TNormalizedBN;
	maxDepositPossible: TNormalizedBN;
	selectedOptionFrom?: TDropdownOption;
	selectedOptionTo?: TDropdownOption;
	onSuccess: VoidFunction;
}
function	SolverChainCoin({
	isDepositing,
	amount,
	maxDepositPossible,
	selectedOptionFrom,
	selectedOptionTo,
	onSuccess
}: TSolver): ReactElement {
	console.warn('SolverChainCoin');
	const {isActive, provider} = useWeb3();
	const {chainID, safeChainID} = useChainID();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);
	const retrieveAllowance = useAllowanceFetcher();
	const isInputTokenEth = selectedOptionFrom?.value === ETH_TOKEN_ADDRESS;
	const isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: allowanceFrom, isLoading: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo && (
			(isDepositing && !isInputTokenEth) || (!isDepositing && isOutputTokenEth)
		) ? [selectedOptionFrom, selectedOptionTo] as TAllowanceFetcher : null,
		retrieveAllowance,
		{revalidateOnFocus: false}
	);

	/* 🔵 - Yearn Finance ******************************************************
	** When we want to withdraw a yvWrappedCoin to the base chain coin, we first
	** need to approve the yvWrappedCoin to be used by the zap contract.
	**************************************************************************/
	async function	onApproveYvWrappedCoin(): Promise<void> {
		if (!selectedOptionTo || !selectedOptionFrom) {
			return;
		}

		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			getEthZapperContract(chainID),
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action using the ETH zap contract to deposit ETH
	** to the selected yvETH vault. The contract will first convert ETH to WETH,
	** aka the vault underlying token, and then deposit it to the vault.
	**************************************************************************/
	async function	onDeposit(): Promise<void> {
		if (!selectedOptionTo) {
			return;
		}
		new Transaction(provider, depositETH, set_txStatusDeposit).populate(
			safeChainID,
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the ETH zap contract to take back
	** some ETH from the selected yvETH vault. The contract will first convert
	** yvETH to wETH, unwrap the wETH and send them to the user.
	**************************************************************************/
	async function	onWithdraw(): Promise<void> {
		if (!selectedOptionTo) {
			return;
		}
		new Transaction(provider, withdrawETH, set_txStatusDeposit).populate(
			chainID,
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Wrapper to decide if we should use the partner contract or not
	**************************************************************************/
	async function	onDepositOrWithdraw(): Promise<void> {
		if (isDepositing) {
			if (isInputTokenEth) {
				await onDeposit();
			}
		} else {
			if (isOutputTokenEth) {
				await onWithdraw();
			}
		}
	}

	if (!isDepositing && txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0)) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(maxDepositPossible.raw)}
				onClick={onApproveYvWrappedCoin}>
				{'Approve'}
			</Button>
		);
	}

	return (
		<Button
			onClick={onDepositOrWithdraw}
			className={'w-full'}
			isBusy={txStatusDeposit.pending}
			isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(maxDepositPossible.raw)}>
			{isDepositing ? 'Deposit' : 'Withdraw'}
		</Button>
	);
}

export {SolverChainCoin};