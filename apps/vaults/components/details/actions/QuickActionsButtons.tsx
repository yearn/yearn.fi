import React, {useCallback, useEffect, useState} from 'react';
import {ethers} from 'ethers';
import {useAsync} from '@react-hookz/web';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver, useSolver} from '@vaults/contexts/useSolver';
import {useWalletForZap} from '@vaults/contexts/useWalletForZaps';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';

function	VaultDetailsQuickActionsButtons(): ReactElement {
	const {refresh} = useWallet();
	const {refresh: refreshZapBalances} = useWalletForZap();
	const {address, isActive} = useWeb3();
	const {safeChainID} = useChainID();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const [txStatusExecuteDeposit, set_txStatusExecuteDeposit] = useState(defaultTxStatus);
	const [txStatusExecuteWithdraw, set_txStatusExecuteWithdraw] = useState(defaultTxStatus);
	const {actionParams, currentVault, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {onApprove, onExecuteDeposit, onExecuteWithdraw, onRetrieveAllowance, currentSolver, expectedOut, isLoadingExpectedOut} = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const [{result: allowanceFrom, status}, actions] = useAsync(onRetrieveAllowance, toNormalizedBN(0));

	useEffect((): void => {
		if (!isLoadingExpectedOut) {
			actions.execute();
		}
	}, [currentSolver, actionParams?.selectedOptionFrom?.value, actions, isActive, address, onRetrieveAllowance, isLoadingExpectedOut, expectedOut]);

	const onSuccess = useCallback(async (): Promise<void> => {
		onChangeAmount(toNormalizedBN(0));
		if ([Solver.VANILLA, Solver.CHAIN_COIN, Solver.PARTNER_CONTRACT].includes(currentSolver)) {
			await refresh([
				{token: toAddress(actionParams?.selectedOptionFrom?.value)},
				{token: toAddress(actionParams?.selectedOptionTo?.value)}
			]);
		} else if ([Solver.INTERNAL_MIGRATION].includes(currentSolver)) {
			await refresh([
				{token: toAddress(actionParams?.selectedOptionFrom?.value)},
				{token: toAddress(actionParams?.selectedOptionTo?.value)}
			]);
		} else if ([Solver.COWSWAP, Solver.PORTALS, Solver.WIDO].includes(currentSolver)) {
			if (isDepositing) { //refresh input from zap wallet, refresh output from default
				await Promise.all([
					refreshZapBalances([{token: toAddress(actionParams?.selectedOptionFrom?.value)}]),
					refresh([{token: toAddress(actionParams?.selectedOptionTo?.value)}])
				]);
			} else {
				await Promise.all([
					refreshZapBalances([{token: toAddress(actionParams?.selectedOptionTo?.value)}]),
					refresh([{token: toAddress(actionParams?.selectedOptionFrom?.value)}])
				]);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentSolver, isDepositing, onChangeAmount, actionParams?.selectedOptionFrom?.value, actionParams?.selectedOptionTo?.value]);

	/* 🔵 - Yearn Finance ******************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**************************************************************************/
	async function	onApproveFrom(): Promise<void> {
		const	shouldApproveInfinite = currentSolver === Solver.PARTNER_CONTRACT || currentSolver === Solver.VANILLA || currentSolver === Solver.INTERNAL_MIGRATION;
		onApprove(
			shouldApproveInfinite ? ethers.constants.MaxUint256 : actionParams?.amount.raw,
			set_txStatusApprove,
			async (): Promise<void> => {
				await actions.execute();
			}
		);
	}

	const isDiffNetwork = !!safeChainID && currentVault.chainID !== safeChainID;

	const isButtonDisabled = !isActive || actionParams?.amount.raw.isZero() || actionParams?.amount.raw.gt(maxDepositPossible.raw) || isLoadingExpectedOut || isDiffNetwork;
	
	/* 🔵 - Yearn Finance ******************************************************
	** Wrapper to decide if we should use the partner contract or not
	**************************************************************************/
	if (
		txStatusApprove.pending || actionParams?.amount.raw.gt(formatBN(allowanceFrom?.raw)) || status !== 'success' && (
			(currentSolver === Solver.VANILLA && isDepositing)
			|| (currentSolver === Solver.CHAIN_COIN && !isDepositing)
			|| (currentSolver === Solver.INTERNAL_MIGRATION)
			|| (currentSolver === Solver.COWSWAP)
			|| (currentSolver === Solver.WIDO)
			|| (currentSolver === Solver.PARTNER_CONTRACT)
		)
	) {
		return (
			<Button
				className={'w-full'}
				isBusy={txStatusApprove.pending}
				isDisabled={isButtonDisabled || expectedOut.raw.isZero()}
				onClick={onApproveFrom}>
				{'Approve'}
			</Button>
		);
	}

	if (isDepositing || currentSolver === Solver.INTERNAL_MIGRATION) {
		return (
			<Button
				onClick={async (): Promise<void> => onExecuteDeposit(set_txStatusExecuteDeposit, onSuccess)}
				className={'w-full'}
				isBusy={txStatusExecuteDeposit.pending}
				isDisabled={isButtonDisabled}>
				{isDepositing ? 'Deposit' : 'Migrate'}
			</Button>
		);
	}

	return (
		<Button
			onClick={async (): Promise<void> => onExecuteWithdraw(set_txStatusExecuteWithdraw, onSuccess)}
			className={'w-full'}
			isBusy={txStatusExecuteWithdraw.pending}
			isDisabled={isButtonDisabled}>
			{'Withdraw'}
		</Button>
	);

}

export default VaultDetailsQuickActionsButtons;
