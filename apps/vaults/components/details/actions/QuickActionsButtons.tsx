import React, {useCallback, useEffect, useState} from 'react';
import {useAsync} from '@react-hookz/web';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver, useSolver} from '@vaults/contexts/useSolver';
import {Button} from '@yearn-finance/web-lib/components/Button';
import ChildWithCondition from '@yearn-finance/web-lib/components/ChildWithCondition';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {MaxUint256, toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';
import type {TNormalizedBN, UnknownPromiseFunction, VoidPromiseFunction} from '@yearn-finance/web-lib/types';

type TApproveButtonProps = {
	onRetrieveAllowance: UnknownPromiseFunction;
};
function	ApproveButton(props: TApproveButtonProps): ReactElement {
	const {isActive} = useWeb3();
	const [txStatusApprove, set_txStatusApprove] = useState(defaultTxStatus);
	const {actionParams, maxDepositPossible} = useActionFlow();
	const {onApprove, currentSolver, expectedOut, isLoadingExpectedOut} = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	** Declare the variable we will need for this component in an easy to read way.
	**********************************************************************************************/
	const isInvalidAmount = toBigInt(actionParams?.amount.raw) > toBigInt(maxDepositPossible.raw) || isZero(actionParams?.amount.raw);
	const isApprovalDisabled = !isActive || isInvalidAmount || isZero(expectedOut.raw) || isLoadingExpectedOut;
	const shouldApproveInfinite = [Solver.PARTNER_CONTRACT, Solver.VANILLA, Solver.INTERNAL_MIGRATION].includes(currentSolver);

	/* 🔵 - Yearn Finance **************************************************************************
	** Trigger an approve web3 action, simply trying to approve `amount` tokens
	** to be used by the Partner contract or the final vault, in charge of
	** depositing the tokens.
	** This approve can not be triggered if the wallet is not active
	** (not connected) or if the tx is still pending.
	**********************************************************************************************/
	const	onApproveFrom = useCallback((): void => {
		onApprove(
			shouldApproveInfinite ? MaxUint256 : actionParams.amount.raw,
			set_txStatusApprove,
			props.onRetrieveAllowance as VoidPromiseFunction
		);
	}, [actionParams.amount.raw, onApprove, props.onRetrieveAllowance, shouldApproveInfinite]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Rendering this component
	**********************************************************************************************/
	return (
		<Button
			className={'w-full'}
			isBusy={txStatusApprove.pending}
			isDisabled={isApprovalDisabled}
			onClick={onApproveFrom}>
			{'Approve'}
		</Button>
	);
}


type TActionButton = {
	isMigrating: boolean;
	isDepositing: boolean;
	isBusy: boolean;
	isDisabled: boolean;
	onAction: UnknownPromiseFunction;
};
function	ActionButton(props: TActionButton): ReactElement {
	const	label = props.isMigrating ? 'Migrate' : props.isDepositing ? 'Deposit' : 'Withdraw';

	return (
		<Button
			onClick={props.onAction}
			className={'w-full'}
			isBusy={props.isBusy}
			isDisabled={props.isDisabled}>
			{label}
		</Button>
	);
}


type TVaultDetailsQuickActionsButtonsWrapped = {
	isAllowanceLoading: boolean;
	allowanceFrom: TNormalizedBN;
	onRetrieveAllowance: UnknownPromiseFunction;
}
function	VaultDetailsQuickActionsButtonsWrapped(props: TVaultDetailsQuickActionsButtonsWrapped): ReactElement {
	const {refresh} = useWallet();
	const {isActive} = useWeb3();
	const [txStatusExecute, set_txStatusExecute] = useState(defaultTxStatus);
	const {actionParams, onChangeAmount, maxDepositPossible, isDepositing} = useActionFlow();
	const {onExecuteDeposit, onExecuteWithdraw, currentSolver, isLoadingExpectedOut} = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	** Declare the variable we will need for this component in an easy to read way.
	**********************************************************************************************/
	const selectedFromAddress = toAddress(actionParams?.selectedOptionFrom?.value);
	const selectedToAddress = toAddress(actionParams?.selectedOptionTo?.value);
	const shouldApproveBySolver = [Solver.INTERNAL_MIGRATION, Solver.COWSWAP, Solver.WIDO, Solver.PARTNER_CONTRACT].includes(currentSolver);
	const isVanillaDeposit = currentSolver === Solver.VANILLA && isDepositing;
	const isChainCoinWithdraw = currentSolver === Solver.CHAIN_COIN && !isDepositing;
	const isLackingAllowance = toBigInt(actionParams?.amount.raw) > toBigInt(props.allowanceFrom.raw);
	const isInvalidAmount = toBigInt(actionParams?.amount.raw) > toBigInt(maxDepositPossible.raw) || isZero(actionParams?.amount.raw);
	const mustApproveFirst = isLackingAllowance || props.isAllowanceLoading && (isVanillaDeposit || isChainCoinWithdraw || shouldApproveBySolver);


	/* 🔵 - Yearn Finance **************************************************************************
	** Once an action is done, we just need to refresh the balances of the input token and the
	** output token (should have less input and more output).
	**********************************************************************************************/
	const onSuccess = useCallback(async (): Promise<void> => {
		onChangeAmount(toNormalizedBN(0));
		await refresh([{token: selectedFromAddress}, {token: selectedToAddress}]);
	}, [onChangeAmount, refresh, selectedFromAddress, selectedToAddress]);


	/* 🔵 - Yearn Finance **************************************************************************
	** Rendering this component
	**********************************************************************************************/
	return (
		<ChildWithCondition
			shouldRender={!mustApproveFirst}
			fallback={<ApproveButton onRetrieveAllowance={props.onRetrieveAllowance} />}>
			<ActionButton
				isMigrating={currentSolver === Solver.INTERNAL_MIGRATION}
				isDepositing={isDepositing}
				isBusy={txStatusExecute.pending}
				isDisabled={!isActive || isInvalidAmount || isLoadingExpectedOut}
				onAction={async (): Promise<void> => {
					if (isDepositing) {
						await onExecuteDeposit(set_txStatusExecute, onSuccess);
					} else {
						await onExecuteWithdraw(set_txStatusExecute, onSuccess);
					}
				}} />
		</ChildWithCondition>
	);
}

function	VaultDetailsQuickActionsButtons(): ReactElement {
	const {onRetrieveAllowance} = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific amount. This hook is
	** called every 10s or when amount/in or out changes. Calls the allowanceFetcher callback.
	**********************************************************************************************/
	const [{result: allowanceFrom, status}, {execute: retrieveAllowance}] = useAsync(onRetrieveAllowance, toNormalizedBN(0));
	useEffect((): void => {
		retrieveAllowance();
	}, [retrieveAllowance, onRetrieveAllowance]);


	/* 🔵 - Yearn Finance **************************************************************************
	** Wrapper to decide if we should use the partner contract or not
	**********************************************************************************************/
	return (
		<VaultDetailsQuickActionsButtonsWrapped
			isAllowanceLoading={status !== 'success'}
			allowanceFrom={allowanceFrom}
			onRetrieveAllowance={retrieveAllowance} />
	);
}

export default VaultDetailsQuickActionsButtons;
