import React, {useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import {approveERC20} from '@common/utils/actions/approveToken';
import {deposit} from '@common/utils/actions/deposit';
import {withdrawShares} from '@common/utils/actions/withdrawShares';

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
function	SolverVanilla({
	isDepositing,
	amount,
	maxDepositPossible,
	selectedOptionFrom,
	selectedOptionTo,
	onSuccess
}: TSolver): ReactElement {
	console.warn('SolverVanilla');
	const {isActive, provider} = useWeb3();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusDeposit, set_txStatusDeposit] = useState(defaultTxStatus);
	const retrieveAllowance = useAllowanceFetcher();

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: allowanceFrom, isLoading: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo ? 
		[selectedOptionFrom, selectedOptionTo] as TAllowanceFetcher : null,
		retrieveAllowance,
		{revalidateOnFocus: false}
	);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the final vault, in charge of depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		if (!selectedOptionFrom || !selectedOptionTo) {
			return;
		}
		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), // token to approve
			toAddress(selectedOptionTo.value), // destination vault
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens to
	** the selected vault.
	**************************************************************************/
	async function	onDepositToVault(): Promise<void> {
		if (!selectedOptionTo) {
			return;
		}
		new Transaction(provider, deposit, set_txStatusDeposit).populate(
			toAddress(selectedOptionTo.value), //destination vault
			amount.raw //amount
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
		
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a withdraw web3 action using the vault contract to take back
	** some underlying token from this specific vault.
	**************************************************************************/
	async function	onWithdrawShares(): Promise<void> {
		if (!selectedOptionFrom) {
			return;
		}
		new Transaction(provider, withdrawShares, set_txStatusDeposit).populate(
			toAddress(selectedOptionFrom.value), //vault address
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
			await onDepositToVault();
		} else {
			await onWithdrawShares();
		}
	}

	if (isDepositing &&( txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0))) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(maxDepositPossible.raw)}
				onClick={onApproveFrom}>
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

export {SolverVanilla};