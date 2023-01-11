import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver, useSolver} from '@vaults/contexts/useSolver';
import {getEthZapperContract} from '@vaults/utils';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';
import {useAllowanceFetcher} from '@common/hooks/useAllowanceFetcher';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TNormalizedBN} from '@common/types/types';


function	shouldUseVanillaAllowance({solver, isInputTokenEth}: {solver: Solver, isInputTokenEth: boolean}): boolean {
	return ([Solver.VANILLA, Solver.CHAIN_COIN, Solver.PARTNER_CONTRACT].includes(solver) && !isInputTokenEth);
}

function	VaultDetailsQuickActionsButtons(): ReactElement {
	const {refresh} = useWallet();
	const {isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const {networks} = useSettings();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusExecuteDeposit, set_txStatusExecuteDeposit] = useState(defaultTxStatus);
	const [txStatusExecuteWithdraw, set_txStatusExecuteWithdraw] = useState(defaultTxStatus);
	const [allowanceFrom, set_allowanceFrom] = useState<TNormalizedBN>(toNormalizedBN(0));
	const {selectedOptionFrom, selectedOptionTo, amount, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {onApprove, onExecuteDeposit, onExecuteWithdraw, currentSolver} = useSolver();
	const retrieveAllowance = useAllowanceFetcher();

	const withVanillaAllowance = shouldUseVanillaAllowance({
		solver: currentSolver,
		isInputTokenEth: selectedOptionFrom?.value === ETH_TOKEN_ADDRESS
	});
	const canInteract = isActive && amount.raw.gt(0) && selectedOptionFrom && selectedOptionTo;

	const spender = useMemo((): TAddress => {
		const isOutputTokenEth = selectedOptionTo?.value === ETH_TOKEN_ADDRESS;

		if (currentSolver === Solver.CHAIN_COIN && isOutputTokenEth) {
			return (toAddress(getEthZapperContract(safeChainID)));
		}
		if (currentSolver === Solver.PARTNER_CONTRACT) {
			return (toAddress(networks?.[safeChainID]?.partnerContractAddress));
		}
		return (toAddress(selectedOptionTo?.value));
	}, [currentSolver, networks, safeChainID, selectedOptionTo?.value]);

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const	{data: vanillAllowanceFrom, isLoading: isValidatingAllowance, mutate: mutateAllowance} = useSWR(
		canInteract && withVanillaAllowance ?
			[selectedOptionFrom, spender] : null,
		retrieveAllowance,
		{revalidateOnFocus: false}
	) as SWRResponse<TNormalizedBN>;

	useEffect((): void => {
		if (withVanillaAllowance) {
			set_allowanceFrom(vanillAllowanceFrom || toNormalizedBN(0));
		}
	}, [vanillAllowanceFrom, withVanillaAllowance]);

	const onSuccess = useCallback(async (): Promise<void> => {
		onChangeAmount(toNormalizedBN(0));
		await refresh();
	}, [onChangeAmount, refresh]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		onApprove(
			set_txStatusApprove,
			async (): Promise<void> => {
				if (currentSolver === Solver.COWSWAP) {
					set_allowanceFrom({
						raw: ethers.constants.MaxUint256,
						normalized: Infinity
					});
				} else {
					await mutateAllowance();
				}
			}
		);
	}

	/* 🔵 - Yearn Finance ******************************************************
	** Wrapper to decide if we should use the partner contract or not
	**************************************************************************/
	if (
		txStatusApprove.pending || amount.raw.gt(allowanceFrom.raw) && (
			(currentSolver === Solver.VANILLA && isDepositing)
			|| (currentSolver === Solver.CHAIN_COIN && !isDepositing)
			|| (currentSolver === Solver.COWSWAP)
			|| (currentSolver === Solver.PARTNER_CONTRACT)
		)
	) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero() || amount.raw.gt(maxDepositPossible.raw)}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	if (isDepositing) {
		return (
			<Button
				onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
				className={'w-full'}
				isBusy={txStatusExecuteDeposit.pending}
				isDisabled={!isActive || amount.raw.isZero() || amount.raw.gt(maxDepositPossible.raw)}>
				{'Deposit'}
			</Button>
		);
	}

	return (
		<Button
			onClick={async (): Promise<void> => onExecuteWithdraw(set_txStatusExecuteWithdraw, onSuccess)}
			className={'w-full'}
			isBusy={txStatusExecuteWithdraw.pending}
			isDisabled={!isActive || amount.raw.isZero() || amount.raw.gt(maxDepositPossible.raw)}>
			{'Withdraw'}
		</Button>
	);

}

export default VaultDetailsQuickActionsButtons;
