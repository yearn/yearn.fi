import React, {useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useYearn} from '@common/contexts/useYearn';
import {useAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import {approveERC20} from '@common/utils/actions/approveToken';
import {depositViaPartner} from '@common/utils/actions/depositViaPartner';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';
import type {TDropdownOption, TNormalizedBN} from '@common/types/types';

export type TSolver = {
	destinationVault: TAddress,
	amount: TNormalizedBN;
	maxDepositPossible: TNormalizedBN;
	selectedOptionFrom?: TDropdownOption;
	selectedOptionTo?: TDropdownOption;
	onSuccess: VoidFunction;
}
function	SolverPartnerContract({
	destinationVault,
	amount,
	maxDepositPossible,
	selectedOptionFrom,
	selectedOptionTo,
	onSuccess
}: TSolver): ReactElement {
	console.warn('SolverPartnerContract');
	const {networks} = useSettings();
	const {isActive, provider} = useWeb3();
	const {safeChainID} = useChainID();
	const {currentPartner} = useYearn();
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
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		if (!selectedOptionFrom || !selectedOptionTo) {
			return;
		}
		new Transaction(provider, approveERC20, set_txStatusApprove).populate(
			toAddress(selectedOptionFrom.value), //token to approve
			toAddress(networks[safeChainID].partnerContractAddress), //partner contract 
			ethers.constants.MaxUint256 //amount
		).onSuccess(async (): Promise<void> => {
			await mutateAllowance();
		}).perform();
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger a deposit web3 action, simply trying to deposit `amount` tokens
	** via the Partner Contract, to the selected vault.
	**************************************************************************/
	async function	onDeposit(): Promise<void> {
		new Transaction(provider, depositViaPartner, set_txStatusDeposit).populate(
			networks[safeChainID].partnerContractAddress,
			currentPartner,
			destinationVault,
			amount.raw
		).onSuccess(async (): Promise<void> => {
			await onSuccess();
		}).perform();
	}

	if (txStatusApprove.pending || amount.raw.gt(allowanceFrom?.raw || 0)) {
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
			onClick={onDeposit}
			className={'w-full'}
			isBusy={txStatusDeposit.pending}
			isDisabled={!isActive || amount.raw.isZero() || (amount.raw).gt(maxDepositPossible.raw)}>
			{'Deposit'}
		</Button>
	);
}

export {SolverPartnerContract};