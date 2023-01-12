import React, {useCallback, useState} from 'react';
import {ethers} from 'ethers';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver, useSolver} from '@vaults/contexts/useSolver';
import {useWalletForZap} from '@vaults/contexts/useWalletForZaps';
import {useAsync} from '@vaults/hooks/useAsync';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';

function	VaultDetailsQuickActionsButtons(): ReactElement {
	const {refresh} = useWallet();
	const {refresh: refreshZapBalances} = useWalletForZap();
	const {isActive} = useWeb3();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusExecuteDeposit, set_txStatusExecuteDeposit] = useState(defaultTxStatus);
	const [txStatusExecuteWithdraw, set_txStatusExecuteWithdraw] = useState(defaultTxStatus);
	const {selectedOptionFrom, selectedOptionTo, amount, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance, currentSolver, expectedOut} = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	// onRetrieveAllowance
	const [allowanceFrom, isValidatingAllowance, mutateAllowance] = useAsync(
		onRetrieveAllowance,
		toNormalizedBN(0),
		[currentSolver, selectedOptionFrom?.value]
	);

	const onSuccess = useCallback(async (): Promise<void> => {
		onChangeAmount(toNormalizedBN(0));
		if ([Solver.VANILLA, Solver.CHAIN_COIN, Solver.PARTNER_CONTRACT].includes(currentSolver)) {
			await refresh([
				{token: toAddress(selectedOptionFrom?.value)},
				{token: toAddress(selectedOptionTo?.value)}
			]);
		} else if ([Solver.COWSWAP, Solver.PORTALS, Solver.WIDO].includes(currentSolver)) {
			if (isDepositing) { //refresh input from zap wallet, refresh output from default
				await Promise.all([
					refreshZapBalances([{token: toAddress(selectedOptionFrom?.value)}]),
					refresh([{token: toAddress(selectedOptionTo?.value)}])
				]);
			} else {
				await Promise.all([
					refreshZapBalances([{token: toAddress(selectedOptionTo?.value)}]),
					refresh([{token: toAddress(selectedOptionFrom?.value)}])
				]);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentSolver, isDepositing, onChangeAmount, selectedOptionFrom?.value, selectedOptionTo?.value]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		const	shouldApproveInfinite = currentSolver === Solver.PARTNER_CONTRACT || currentSolver === Solver.VANILLA;
		onApprove(
			shouldApproveInfinite ? ethers.constants.MaxUint256 : amount.raw,
			set_txStatusApprove,
			async (): Promise<void> => {
				if ([Solver.COWSWAP, Solver.WIDO, Solver.PORTALS].includes(currentSolver)) {
					set_allowanceFrom(toNormalizedBN(ethers.constants.MaxUint256));
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
		txStatusApprove.pending || amount.raw.gt(formatBN(allowanceFrom?.raw)) && (
			(currentSolver === Solver.VANILLA && isDepositing)
			|| (currentSolver === Solver.CHAIN_COIN && !isDepositing)
			|| (currentSolver === Solver.COWSWAP)
			|| (currentSolver === Solver.WIDO)
			|| (currentSolver === Solver.PARTNER_CONTRACT)
		)
	) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending || isValidatingAllowance}
				isDisabled={!isActive || amount.raw.isZero() || amount.raw.gt(maxDepositPossible.raw) || expectedOut.raw.isZero()}
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
